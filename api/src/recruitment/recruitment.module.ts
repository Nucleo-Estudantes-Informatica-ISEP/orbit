import { Module } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentController } from './recruitment.controller';
import { PrismaService } from '../prisma.service';
import { RecruitmentCommentController } from './recruitment-comment.controller';
import { RecruitmentCommentService } from './recruitment-comment.service';

@Module({
  controllers: [RecruitmentController, RecruitmentCommentController],
  providers: [RecruitmentService, RecruitmentCommentService, PrismaService],
})
export class RecruitmentModule {}
