import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { BoardsModule } from './boards/boards.module';
import { TasksModule } from './tasks/tasks.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { ProjectsModule } from './projects/projects.module';
import { RolesModule } from './roles/roles.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ResourcesModule } from './resources/resources.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { InventoryModule } from './inventory/inventory.module';
import { PlansModule } from './plans/plans.module';
import { DebtsModule } from './debts/debts.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [UsersModule, DepartmentsModule, BoardsModule, TasksModule, RecruitmentModule, AuthModule, AnnouncementsModule, ResourcesModule, EventsModule, ProjectsModule, RolesModule, UserSettingsModule, AuditLogsModule, FilesModule, InventoryModule, PlansModule, DebtsModule],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
