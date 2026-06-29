import { Module } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { UserSettingsController } from './user-settings.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [UserSettingsController],
  providers: [UserSettingsService, PrismaService],
})
export class UserSettingsModule {}
