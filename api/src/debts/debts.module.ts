import { Module } from '@nestjs/common';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { FilesModule } from '../files/files.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [FilesModule],
  controllers: [DebtsController],
  providers: [DebtsService, PrismaService],
})
export class DebtsModule {}
