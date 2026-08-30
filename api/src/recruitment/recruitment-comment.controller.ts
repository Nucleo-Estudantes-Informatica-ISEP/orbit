import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RecruitmentCommentService } from './recruitment-comment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CandidateIdParamDto,
  CreateRecruitmentCommentDto,
  IdParamDto,
} from '../contracts/request.dto';
import { RecruitmentCommentResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('recruitment-comments')
@ApiProtectedController()
@Controller('recruitment/comments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruitmentCommentController {
  constructor(private svc: RecruitmentCommentService) {}

  @Post()
  @Permissions('RECRUITMENT_CREATE')
  @ApiCreatedResponse({ type: RecruitmentCommentResponseDto })
  create(
    @CurrentUser('userId') actorId: string,
    @Body() body: CreateRecruitmentCommentDto,
  ) {
    return this.svc.create({ ...body, createdById: actorId });
  }

  @Get('candidate/:candidateId')
  @Permissions('RECRUITMENT_READ')
  @ApiOkResponse({ type: RecruitmentCommentResponseDto, isArray: true })
  findAllForCandidate(@Param() params: CandidateIdParamDto) {
    return this.svc.findAllForCandidate(params.candidateId);
  }

  @Get(':id')
  @Permissions('RECRUITMENT_READ')
  @ApiOkResponse({ type: RecruitmentCommentResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Delete(':id')
  @Permissions('RECRUITMENT_DELETE')
  @ApiOkResponse({ type: RecruitmentCommentResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
