import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { FilesModule } from '../files/files.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [FilesModule],
  controllers: [PlansController],
  providers: [PlansService, PrismaService],
})
export class PlansModule {}
