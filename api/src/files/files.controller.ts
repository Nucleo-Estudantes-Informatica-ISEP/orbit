import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Res,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { MinioService } from './minio.service';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { FileKeyParamDto, PaginationQueryDto } from '../contracts/request.dto';
import { FileResponseDto, MessageResponseDto, PaginatedFileResponseDto } from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';

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

@ApiTags('files')
@ApiProtectedController()
@Controller('files')
export class FilesController {
  constructor(private readonly minioService: MinioService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('FILES_VIEW')
  @ApiOkResponse({ type: PaginatedFileResponseDto })
  async list(
    @Query() query: PaginationQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(100, query.pageSize ?? 20);
    const all = (await this.minioService.listObjects()).filter((f) => f.name && f.lastModified) as { name: string; size: number; lastModified: Date }[];
    const sorted = all.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    const total = sorted.length;
    const items = sorted.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('FILES_UPLOAD')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: FileResponseDto })
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

  @Delete(':key')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('FILES_DELETE')
  @ApiOkResponse({ type: MessageResponseDto })
  async deleteFile(@Param() params: FileKeyParamDto) {
    try {
      await this.minioService.getObjectStat(params.key);
    } catch {
      throw new NotFoundException('Ficheiro não encontrado');
    }
    await this.minioService.deleteObject(params.key);
    return { message: 'Ficheiro eliminado com sucesso' };
  }

  @Get('*key')
  @UseGuards(JwtAuthGuard)
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async getFile(@Param() params: FileKeyParamDto, @Res() res: Response) {
    try {
      const stat = await this.minioService.getObjectStat(params.key);
      const stream = await this.minioService.getObject(params.key);
      const ext = path.extname(params.key).toLowerCase();
      const contentType =
        (stat.metaData?.['content-type'] as string | undefined) ??
        (stat.metaData?.['Content-Type'] as string | undefined) ??
        mimeFromExt(ext);

      const disposition = INLINE_TYPES.has(contentType) ? 'inline' : 'attachment';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${path.basename(params.key)}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      if (stat.size) res.setHeader('Content-Length', stat.size);
      stream.pipe(res);
    } catch {
      res.status(404).json({ message: 'Ficheiro não encontrado' });
    }
  }
}
