import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface UserSettingsInput {
  userId: string;
  darkMode?: boolean;
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
  language?: string;
}

@Injectable()
export class UserSettingsService {
  constructor(private prisma: PrismaService) {}

  create(data: UserSettingsInput) {
    return this.prisma.userSettings.create({ data });
  }

  async findOne(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!settings)
      throw new NotFoundException('Settings not found for this user');
    return settings;
  }

  update(userId: string, data: Partial<Omit<UserSettingsInput, 'userId'>>) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  remove(userId: string) {
    return this.prisma.userSettings.delete({ where: { userId } });
  }
}
