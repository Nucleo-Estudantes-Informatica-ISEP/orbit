import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RecruitmentCommentService } from './recruitment-comment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('recruitment/comments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruitmentCommentController {
  constructor(private svc: RecruitmentCommentService) {}

  @Post()
  @Permissions('RECRUITMENT_CREATE')
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Get('candidate/:candidateId')
  @Permissions('RECRUITMENT_READ')
  findAllForCandidate(@Param('candidateId') candidateId: string) {
    return this.svc.findAllForCandidate(candidateId);
  }

  @Get(':id')
  @Permissions('RECRUITMENT_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Delete(':id')
  @Permissions('RECRUITMENT_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
