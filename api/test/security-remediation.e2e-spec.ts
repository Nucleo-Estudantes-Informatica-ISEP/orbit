import { randomUUID } from 'node:crypto';
import type { SystemPermission } from '@prisma/client';
import { AnnouncementsService } from '../src/announcements/announcements.service';
import type { AuthService } from '../src/auth/auth.service';
import {
  attachmentPermissions,
  requireOwnedAttachments,
} from '../src/files/file-access';
import type { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma.service';
import { RolesService } from '../src/roles/roles.service';
import { UsersService } from '../src/users/users.service';

describe('resource-level security policies (e2e)', () => {
  const prisma = new PrismaService();
  const roles = new RolesService(prisma);
  const mail = {} as MailService;
  const users = new UsersService(prisma, mail, {} as AuthService);
  const announcements = new AnnouncementsService(prisma, mail);
  const departmentId = randomUUID();
  const adminId = randomUUID();
  const editorId = randomUUID();
  const memberId = randomUUID();
  const members = [adminId, editorId, memberId];
  const adminRoleId = randomUUID();
  const editorRoleId = randomUUID();
  const announcementId = randomUUID();
  const attachment = `${randomUUID()}.pdf`;
  const adminPermissions: SystemPermission[] = [
    'USERS_CREATE',
    'USERS_UPDATE',
    'USERS_DELETE',
    'USERS_MANAGE_CREDENTIALS',
    'ROLES_CREATE',
    'ROLES_UPDATE',
    'ROLES_DELETE',
    'ROLES_ASSIGN',
  ];

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.department.create({
      data: { id: departmentId, name: departmentId },
    });
    await prisma.user.createMany({
      data: members.map((id) => ({
        id,
        name: 'Synthetic member',
        email: `${id}@example.test`,
        password: 'fixture-without-a-login',
        departmentId,
      })),
    });
    await prisma.role.createMany({
      data: [
        { id: adminRoleId, name: adminRoleId, permissions: adminPermissions },
        {
          id: editorRoleId,
          name: editorRoleId,
          permissions: ['USERS_UPDATE', 'ROLES_CREATE'],
        },
      ],
    });
    await prisma.userRole.createMany({
      data: [
        { userId: adminId, roleId: adminRoleId },
        { userId: editorId, roleId: editorRoleId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { performedById: { in: members } },
    });
    await prisma.announcement.deleteMany({ where: { id: announcementId } });
    await prisma.uploadedFile.deleteMany({ where: { key: attachment } });
    await prisma.user.deleteMany({ where: { id: { in: members } } });
    await prisma.role.deleteMany({
      where: { id: { in: [adminRoleId, editorRoleId] } },
    });
    await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.$disconnect();
  });

  it('limits delegation and records a successful edit in the same transaction', async () => {
    await expect(
      roles.create(
        { name: randomUUID(), permissions: ['USERS_DELETE'] },
        editorId,
      ),
    ).rejects.toThrow('administrative permissions');
    await expect(
      users.update(memberId, { email: 'changed@example.test' }, editorId),
    ).rejects.toThrow('administrative permissions');
    await expect(
      users.update(adminId, { status: 'INACTIVE' }, adminId),
    ).rejects.toThrow('last active administrator');
    await expect(
      users.update(memberId, { name: 'Edited member' }, editorId),
    ).resolves.toMatchObject({ name: 'Edited member' });
    await expect(
      prisma.auditLog.findFirst({
        where: {
          performedById: editorId,
          entity: 'User',
          entityId: memberId,
          action: 'UPDATE',
        },
      }),
    ).resolves.not.toBeNull();
    await expect(users.remove(memberId, adminId)).resolves.not.toHaveProperty(
      'password',
    );
  });

  it('applies the same audience to details and restricts read acknowledgement to the recipient', async () => {
    await prisma.announcement.create({
      data: {
        id: announcementId,
        title: 'Private notice',
        content: '<p>Agenda</p>',
        visibility: 'PRIVATE',
        type: 'ANNOUNCEMENT',
        targetUserId: editorId,
        createdById: adminId,
      },
    });
    await expect(
      announcements.findOne(announcementId, randomUUID()),
    ).rejects.toThrow('Announcement not found');
    await expect(
      announcements.markRead(announcementId, adminId),
    ).rejects.toThrow('Announcement not found');
    await expect(
      announcements.findOne(announcementId, editorId),
    ).resolves.toMatchObject({ id: announcementId });
    await expect(
      announcements.markRead(announcementId, editorId),
    ).resolves.toMatchObject({ read: true });
  });

  it('recognizes resource link aliases and lets only the upload owner add a reference', async () => {
    const id = randomUUID();
    await prisma.uploadedFile.create({
      data: { key: attachment, uploadedById: editorId },
    });
    await expect(
      prisma.$transaction((tx) =>
        requireOwnedAttachments(tx, adminId, [attachment]),
      ),
    ).rejects.toThrow('own uploads');
    await prisma.$transaction(async (tx) => {
      await requireOwnedAttachments(tx, editorId, [attachment]);
      await tx.resource.create({
        data: { id, title: 'Storage fixture', url: `/api/files/${attachment}` },
      });
    });
    try {
      expect(
        (await attachmentPermissions(prisma, [attachment])).get(attachment),
      ).toEqual(new Set(['RESOURCES_READ']));
      await expect(
        prisma.$transaction((tx) =>
          requireOwnedAttachments(tx, editorId, [attachment]),
        ),
      ).rejects.toThrow('own uploads');
    } finally {
      await prisma.resource.delete({ where: { id } });
    }
  });
});
