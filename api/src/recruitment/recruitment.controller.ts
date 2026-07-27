import { Body, Controller, Delete, Get, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import type { Response } from 'express';
import { ApiCreatedResponse, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { CreateCandidateDto, IdParamDto, UpdateCandidateDto } from '../contracts/request.dto';
import { CandidateResponseDto, DeletedCountResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';

@ApiTags('candidates')
@ApiProtectedController()
@Controller('candidates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruitmentController {
  constructor(private svc: RecruitmentService) {}

  @Post()
  @Permissions('RECRUITMENT_CREATE')
  @ApiCreatedResponse({ type: CandidateResponseDto })
  create(@Body() body: CreateCandidateDto) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('RECRUITMENT_READ')
  @ApiOkResponse({ type: CandidateResponseDto, isArray: true })
  findAll() {
    return this.svc.findAll();
  }

  @Get('export/all')
  @Permissions('RECRUITMENT_READ')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async exportAll(@Res() res: Response) {
    const buffer = await this.svc.exportAll();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="candidatos.pdf"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get('export/:id')
  @Permissions('RECRUITMENT_READ')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async exportOne(@Param() params: IdParamDto, @Res() res: Response) {
    const buffer = await this.svc.exportOne(params.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="candidato-${params.id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get(':id')
  @Permissions('RECRUITMENT_READ')
  @ApiOkResponse({ type: CandidateResponseDto })
  findOne(@Param() params: IdParamDto) {
    return this.svc.findOne(params.id);
  }

  @Put(':id')
  @Permissions('RECRUITMENT_UPDATE')
  @ApiOkResponse({ type: CandidateResponseDto })
  update(@Param() params: IdParamDto, @Body() body: UpdateCandidateDto) {
    return this.svc.update(params.id, body);
  }

  @Delete()
  @Permissions('RECRUITMENT_DELETE')
  @ApiOkResponse({ type: DeletedCountResponseDto })
  clearAll() {
    return this.svc.clearAll();
  }

  @Delete(':id')
  @Permissions('RECRUITMENT_DELETE')
  @ApiOkResponse({ type: CandidateResponseDto })
  remove(@Param() params: IdParamDto) {
    return this.svc.remove(params.id);
  }
}
