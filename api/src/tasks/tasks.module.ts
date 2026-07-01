import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaService } from '../prisma.service';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AnnouncementsModule, MailModule],
  controllers: [TasksController],
  providers: [TasksService, PrismaService],
})
export class TasksModule {}
