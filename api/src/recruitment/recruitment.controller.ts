import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  RecruitmentService,
  type CreateCandidateInput,
  type UpdateCandidateInput,
} from './recruitment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import type { Response } from 'express';

@Controller('candidates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecruitmentController {
  constructor(private svc: RecruitmentService) {}

  @Post()
  @Permissions('RECRUITMENT_CREATE')
  create(@Body() body: CreateCandidateInput) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('RECRUITMENT_READ')
  findAll() {
    return this.svc.findAll();
  }

  @Get('export/all')
  @Permissions('RECRUITMENT_READ')
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
  async exportOne(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.svc.exportOne(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="candidato-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Get(':id')
  @Permissions('RECRUITMENT_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('RECRUITMENT_UPDATE')
  update(@Param('id') id: string, @Body() body: UpdateCandidateInput) {
    return this.svc.update(id, body);
  }

  @Delete()
  @Permissions('RECRUITMENT_DELETE')
  clearAll() {
    return this.svc.clearAll();
  }

  @Delete(':id')
  @Permissions('RECRUITMENT_DELETE')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
