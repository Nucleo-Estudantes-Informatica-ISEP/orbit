import { Module } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentController } from './recruitment.controller';
import { FilesModule } from '../files/files.module';
import { PrismaService } from '../prisma.service';
import { RecruitmentCommentController } from './recruitment-comment.controller';
import { RecruitmentCommentService } from './recruitment-comment.service';

@Module({
  imports: [FilesModule],
  controllers: [RecruitmentController, RecruitmentCommentController],
  providers: [RecruitmentService, RecruitmentCommentService, PrismaService],
})
export class RecruitmentModule {}
