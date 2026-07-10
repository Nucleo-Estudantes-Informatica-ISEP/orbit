import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { FilesModule } from '../files/files.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [FilesModule],
  controllers: [ResourcesController],
  providers: [ResourcesService, PrismaService],
})
export class ResourcesModule {}
