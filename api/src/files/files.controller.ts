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
  ConflictException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { MinioService } from './minio.service';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { FileKeyParamDto, PaginationQueryDto } from '../contracts/request.dto';
import {
  FileResponseDto,
  ErrorResponseDto,
  MessageResponseDto,
  PaginatedFileResponseDto,
} from '../contracts/response.dto';
import { ApiProtectedController } from '../contracts/openapi.decorators';
import { PrismaService } from '../prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-request';
import {
  attachmentPermissions,
  canReadFile,
  lockFile,
  validFileKey,
} from './file-access';
import { pipeline } from 'node:stream/promises';
import type { Prisma } from '@prisma/client';

type FileInventory = Awaited<ReturnType<MinioService['listObjects']>>;

const maxFileSize = 10 * 1024 * 1024;
const INLINE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
]);

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}

@ApiTags('files')
@ApiProtectedController()
@Controller('files')
export class FilesController {
  private visibleInventory?: {
    inventory: FileInventory;
    snapshot: string;
    actorKey: string;
    files: FileInventory;
  };

  constructor(
    private readonly minioService: MinioService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('FILES_VIEW')
  @ApiOkResponse({ type: PaginatedFileResponseDto })
  async list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(100, query.pageSize ?? 20);
    const inventory = await this.minioService.listObjects();
    const actorKey = JSON.stringify([
      actor.userId,
      [...actor.permissions].sort(),
    ]);
    const visible = await this.prisma.$transaction(
      async (tx) => {
        // A cached view is valid only when PostgreSQL sees the same committed
        // state. Repeatable read gives every permission query that snapshot.
        const [{ snapshot }] = await tx.$queryRaw<
          { snapshot: string }[]
        >`SELECT pg_current_snapshot()::text AS snapshot`;
        const cached = this.visibleInventory;
        if (
          cached?.inventory === inventory &&
          cached.snapshot === snapshot &&
          cached.actorKey === actorKey
        ) {
          return cached.files;
        }
        const files = await this.filterInventory(tx, inventory, actor);
        this.visibleInventory = { inventory, snapshot, actorKey, files };
        return files;
      },
      { isolationLevel: 'RepeatableRead' },
    );
    const items = visible.slice((page - 1) * pageSize, page * pageSize);
    return { items, total: visible.length, page, pageSize };
  }

  private async filterInventory(
    tx: Prisma.TransactionClient,
    all: FileInventory,
    actor: AuthenticatedUser,
  ) {
    const visible: typeof all = [];
    const permissions = await attachmentPermissions(
      tx,
      all.map(({ name }) => name),
      { fullInventory: true },
    );
    for (let start = 0; start < all.length; start += 500) {
      const batch = all.slice(start, start + 500);
      const keys = batch.map((object) => object.name);
      const files = await tx.uploadedFile.findMany({
        where: { key: { in: keys } },
        select: {
          key: true,
          uploadedById: true,
          attached: true,
          deletedAt: true,
        },
      });
      const byKey = new Map(files.map((file) => [file.key, file]));
      visible.push(
        ...batch.filter(({ name }) =>
          canReadFile(actor, byKey.get(name), permissions.get(name)),
        ),
      );
    }
    return visible.sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
    );
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('FILES_UPLOAD')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: maxFileSize, files: 1, fields: 0, parts: 2 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: FileResponseDto })
  @ApiPayloadTooLargeResponse({ type: ErrorResponseDto })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') uploadedById: string,
  ) {
    if (!file) throw new BadRequestException('Nenhum ficheiro enviado');
    const ext = path.extname(file.originalname).toLowerCase();
    const objectKey = `${randomUUID()}${/^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ''}`;
    const contentType = mimeFromExt(ext);
    await this.prisma.uploadedFile.create({
      data: { key: objectKey, uploadedById },
    });
    try {
      await this.minioService.uploadObject(
        objectKey,
        file.buffer,
        contentType,
        file.size,
      );
    } catch (error) {
      await this.prisma.uploadedFile.update({
        where: { key: objectKey },
        data: { deletedAt: new Date() },
      });
      throw error;
    }
    return {
      key: objectKey,
      originalName: file.originalname,
      mimeType: contentType,
      size: file.size,
    };
  }

  @Delete('*key')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('FILES_DELETE')
  @ApiOkResponse({ type: MessageResponseDto })
  async deleteFile(@Param() params: FileKeyParamDto) {
    if (!validFileKey(params.key))
      throw new BadRequestException('Invalid file key');
    await this.prisma.$transaction(async (tx) => {
      await lockFile(tx, params.key);
      const permissions = await attachmentPermissions(tx, [params.key]);
      if (permissions.has(params.key))
        throw new ConflictException('File is still attached to a record');
      const deletedAt = new Date();
      await tx.uploadedFile.upsert({
        where: { key: params.key },
        create: { key: params.key, deletedAt },
        update: { deletedAt },
      });
    });
    await this.minioService.deleteObject(params.key);
    return { message: 'Ficheiro eliminado com sucesso' };
  }

  @Get('*key')
  @UseGuards(JwtAuthGuard)
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async getFile(
    @Param() params: FileKeyParamDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response,
  ) {
    if (!validFileKey(params.key))
      throw new BadRequestException('Invalid file key');
    const [file, permissions] = await Promise.all([
      this.prisma.uploadedFile.findUnique({ where: { key: params.key } }),
      attachmentPermissions(this.prisma, [params.key]),
    ]);
    if (!canReadFile(actor, file ?? undefined, permissions.get(params.key))) {
      throw new NotFoundException('Ficheiro não encontrado');
    }

    try {
      const stat = await this.minioService.getObjectStat(params.key);
      const stream = await this.minioService.getObject(params.key);
      const ext = path.extname(params.key).toLowerCase();
      const contentType = stat.contentType ?? mimeFromExt(ext);

      const disposition = INLINE_TYPES.has(contentType)
        ? 'inline'
        : 'attachment';
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename*=UTF-8''${encodeURIComponent(path.basename(params.key)).replace(/['()*]/g, (character) => '%' + character.charCodeAt(0).toString(16))}`,
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Security-Policy', 'sandbox');
      if (stat.size) res.setHeader('Content-Length', stat.size);
      await pipeline(stream, res);
    } catch {
      if (res.headersSent || res.destroyed) return;
      throw new NotFoundException('Ficheiro não encontrado');
    }
  }
}
