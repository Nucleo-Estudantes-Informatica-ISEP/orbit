import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { MinioService } from './minio.service';
import { randomUUID } from 'crypto';
import * as path from 'path';

const INLINE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/html',
]);

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}

@Controller('files')
export class FilesController {
  constructor(private readonly minioService: MinioService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('FILES_UPLOAD')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum ficheiro enviado');
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Ficheiro excede o limite de 10MB');
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const objectKey = `${randomUUID()}${ext}`;
    await this.minioService.uploadObject(
      objectKey,
      file.buffer,
      file.mimetype,
      file.size,
    );
    return {
      key: objectKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  @Get('*key')
  async getFile(@Param('key') key: string, @Res() res: Response) {
    try {
      const stat = await this.minioService.getObjectStat(key);
      const stream = await this.minioService.getObject(key);
      const ext = path.extname(key).toLowerCase();
      const contentType =
        (stat.metaData?.['content-type'] as string | undefined) ??
        (stat.metaData?.['Content-Type'] as string | undefined) ??
        mimeFromExt(ext);

      const disposition = INLINE_TYPES.has(contentType) ? 'inline' : 'attachment';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${path.basename(key)}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      if (stat.size) res.setHeader('Content-Length', stat.size);
      stream.pipe(res);
    } catch {
      res.status(404).json({ message: 'Ficheiro não encontrado' });
    }
  }
}
