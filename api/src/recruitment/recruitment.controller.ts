import { Body, Controller, Delete, Get, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
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
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Get()
  @Permissions('RECRUITMENT_READ')
  findAll() {
    return this.svc.findAll();
  }

  @Get('export/all')
  @Permissions('RECRUITMENT_READ')
  async exportAll(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.svc.exportAll();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="candidatos.pdf"',
      'Content-Length': buffer.length,
    });
    return buffer;
  }

  @Get('export/:id')
  @Permissions('RECRUITMENT_READ')
  async exportOne(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.svc.exportOne(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="candidato-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    return buffer;
  }

  @Get(':id')
  @Permissions('RECRUITMENT_READ')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Permissions('RECRUITMENT_UPDATE')
  update(@Param('id') id: string, @Body() body: any) {
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
