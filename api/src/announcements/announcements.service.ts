import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  private uniqueUserIds(userIds: Array<string | undefined | null>, excludeUserId?: string) {
    return [...new Set(userIds.filter((userId): userId is string => Boolean(userId && userId !== excludeUserId)))];
  }

  private readonly include = {
    createdBy: { select: { id: true, name: true, email: true } },
    targetUser: { select: { id: true, name: true, email: true } },
    announcementDepartments: { include: { department: { select: { id: true, name: true } } } },
  };

  async create(data: CreateAnnouncementDto) {
    const {
      departmentIds,
      targetUserIds,
      content,
      description,
      createdById,
      performedById,
      targetUserId,
      visibility,
      type,
      pinned,
      date,
      viewed,
      ...announcementData
    } = data;

    const resolvedContent = content ?? description ?? '';
    const title = (announcementData as any).title || resolvedContent.slice(0, 80);

    // PRIVATE with multiple target users → one announcement per user
    if (visibility === 'PRIVATE' && targetUserIds && targetUserIds.length > 0) {
      const result = await this.prisma.announcement.createMany({
        data: targetUserIds.map((uid) => ({
          ...announcementData,
          content: resolvedContent,
          createdById,
          targetUserId: uid,
          type: type ?? 'ANNOUNCEMENT',
          visibility: 'PRIVATE' as const,
          pinned: pinned ?? false,
        })),
      });
      this.notifyUsers(targetUserIds, title, resolvedContent, 'privado').catch(() => {});
      return result;
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        ...announcementData,
        content: resolvedContent,
        createdById,
        targetUserId,
        type: type ?? 'ANNOUNCEMENT',
        visibility,
        pinned,
        ...(date ? { createdAt: date } : {}),
        ...(departmentIds && departmentIds.length > 0
          ? {
              announcementDepartments: {
                create: departmentIds.map((departmentId) => ({
                  department: { connect: { id: departmentId } },
                })),
              },
            }
          : {}),
      },
      include: this.include,
    });

    if (visibility === 'PRIVATE' && targetUserId) {
      this.notifyUsers([targetUserId], title, resolvedContent, 'privado').catch(() => {});
    } else if (visibility === 'DEPARTMENT' && departmentIds?.length) {
      this.prisma.user.findMany({
        where: { departmentId: { in: departmentIds } },
        select: { id: true },
      }).then((users) => {
        const ids = users.map((u) => u.id);
        if (ids.length > 0) this.notifyUsers(ids, title, resolvedContent, 'departamento').catch(() => {});
      }).catch(() => {});
    } else if (visibility === 'PUBLIC') {
      this.prisma.user.findMany({
        select: { id: true },
      }).then((users) => {
        const ids = users.map((u) => u.id);
        if (ids.length > 0) this.notifyUsers(ids, title, resolvedContent, 'global').catch(() => {});
      }).catch(() => {});
    }

    return announcement;
  }

  private async notifyUsers(userIds: string[], title: string, content: string, origin: string) {
    const settings = await this.prisma.userSettings.findMany({
      where: { userId: { in: userIds }, emailNotifications: true },
      include: { user: { select: { name: true, email: true } } },
    });
    await Promise.all(settings.map((s) =>
      this.mailService.sendAnnouncementNotification(s.user.email, s.user.name, title, content, origin),
    ));
  }

  async findAll(userId: string, filters?: { page?: string; pageSize?: string; visibility?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(filters?.pageSize ?? 6) || 6));
    const where: any = {
      AND: [
        {
          OR: [
            { visibility: 'PUBLIC' },
            {
              visibility: 'DEPARTMENT',
              announcementDepartments: { some: { departmentId: user?.departmentId ?? '' } },
            },
            { visibility: 'PRIVATE', targetUserId: userId, type: 'ANNOUNCEMENT' },
            { visibility: 'PRIVATE', createdById: userId, type: 'ANNOUNCEMENT' },
          ],
        },
        ...(filters?.visibility && filters.visibility !== 'ALL' ? [{ visibility: filters.visibility }] : []),
      ],
    };
    const [total, items] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        include: this.include,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async findAllRaw(userId: string, visibility?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    const where: any = {
      OR: [
        { visibility: 'PUBLIC' },
        {
          visibility: 'DEPARTMENT',
          announcementDepartments: { some: { departmentId: user?.departmentId ?? '' } },
        },
        { visibility: 'PRIVATE', targetUserId: userId, type: 'ANNOUNCEMENT' },
        { visibility: 'PRIVATE', createdById: userId, type: 'ANNOUNCEMENT' },
      ],
      ...(visibility && visibility !== 'ALL' ? { visibility } : {}),
    };
    return this.prisma.announcement.findMany({ where, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], include: this.include });
  }

  createManyForUsers(userIds: Array<string | undefined | null>, type: string, content: string, excludeUserId?: string) {
    const targets = this.uniqueUserIds(userIds, excludeUserId);

    if (targets.length === 0) {
      return Promise.resolve({ count: 0 });
    }

    return this.prisma.announcement.createMany({
      data: targets.map((targetUserId) => ({
        targetUserId,
        type,
        content,
        title: content,
        visibility: 'PRIVATE',
      })),
    });
  }

  createForDepartmentUsers(departmentIds: Array<string | undefined | null>, type: string, content: string, excludeUserId?: string) {
    const uniqueDepartmentIds = [...new Set(departmentIds.filter((departmentId): departmentId is string => Boolean(departmentId)))];

    if (uniqueDepartmentIds.length === 0) {
      return Promise.resolve({ count: 0 });
    }

    return this.prisma.user.findMany({
      where: { departmentId: { in: uniqueDepartmentIds } },
      select: { id: true },
    }).then((users) => this.createManyForUsers(users.map((user) => user.id), type, content, excludeUserId));
  }

  async findOne(id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id }, include: this.include });
    if (!a) throw new NotFoundException('Announcement not found');
    return a;
  }

  findAllForUser(userId: string) {
    return this.prisma.announcement.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: this.include,
    });
  }

  markRead(id: string) {
    return this.prisma.announcement.update({ where: { id }, data: { read: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.announcement.updateMany({ where: { targetUserId: userId, read: false }, data: { read: true } });
  }

  async update(id: string, data: any) {
    const { performedById, departmentIds, targetUserIds, ...updateData } = data;
    return this.prisma.$transaction(async (tx) => {
      if (departmentIds !== undefined) {
        await tx.announcementDepartment.deleteMany({ where: { announcementId: id } });
      }
      return tx.announcement.update({
        where: { id },
        data: {
          ...updateData,
          ...(Array.isArray(departmentIds) && departmentIds.length > 0
            ? {
                announcementDepartments: {
                  create: departmentIds.map((deptId: string) => ({
                    department: { connect: { id: deptId } },
                  })),
                },
              }
            : {}),
        },
        include: this.include,
      });
    });
  }

  remove(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }

  async togglePin(id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id }, select: { pinned: true } });
    if (!a) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  }

}
