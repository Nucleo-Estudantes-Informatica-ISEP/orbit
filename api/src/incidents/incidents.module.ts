import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { FilesModule } from '../files/files.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [FilesModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, PrismaService],
})
export class IncidentsModule {}
