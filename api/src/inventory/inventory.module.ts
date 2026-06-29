import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { FilesModule } from '../files/files.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [FilesModule],
  controllers: [InventoryController],
  providers: [InventoryService, PrismaService],
})
export class InventoryModule {}
