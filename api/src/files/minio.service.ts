import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  paginateListObjectsV2,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const { MINIO_BUCKET, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY } =
      process.env;
    if (
      process.env.NODE_ENV === 'production' &&
      (!MINIO_BUCKET ||
        !MINIO_ENDPOINT ||
        !MINIO_ACCESS_KEY ||
        !MINIO_SECRET_KEY ||
        MINIO_ACCESS_KEY === 'minioadmin' ||
        MINIO_SECRET_KEY === 'minioadmin')
    ) {
      throw new Error(
        'Production requires an explicitly configured S3 endpoint, bucket and restricted identity.',
      );
    }
    this.bucket = MINIO_BUCKET ?? 'orbit';
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const port = process.env.MINIO_PORT ?? '9000';
    this.client = new S3Client({
      region: process.env.MINIO_REGION ?? 'us-east-1',
      endpoint: `${protocol}://${MINIO_ENDPOINT ?? 'minio'}:${port}`,
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: MINIO_ACCESS_KEY ?? 'minioadmin',
        secretAccessKey: MINIO_SECRET_KEY ?? 'minioadmin',
      },
    });
  }

  async onModuleInit() {
    const input = { Bucket: this.bucket };
    try {
      await this.client.send(new HeadBucketCommand(input));
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        // SDK failures can contain signed request or provider details.
        // eslint-disable-next-line preserve-caught-error
        throw new Error('Orbit storage bucket is unavailable');
      }
      if (
        error instanceof S3ServiceException &&
        error.$metadata.httpStatusCode === 404
      ) {
        await this.client.send(new CreateBucketCommand(input));
      } else {
        this.logger.warn('Development object store is unavailable.');
      }
    }
  }

  async uploadObject(
    objectKey: string,
    buffer: Buffer,
    mimeType: string,
    size: number,
  ) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: size,
      }),
    );
  }

  async getObject(objectKey: string) {
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    if (!(Body instanceof Readable))
      throw new Error('Object storage returned no readable body');
    return Body;
  }

  async deleteObject(objectKey: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }

  async getObjectStat(objectKey: string) {
    const object = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    return { size: object.ContentLength, contentType: object.ContentType };
  }

  async listObjects() {
    const objects: { name: string; size: number; lastModified: Date }[] = [];
    for await (const page of paginateListObjectsV2(
      { client: this.client },
      { Bucket: this.bucket },
    )) {
      for (const object of page.Contents ?? []) {
        if (object.Key && object.LastModified) {
          objects.push({
            name: object.Key,
            size: object.Size ?? 0,
            lastModified: object.LastModified,
          });
        }
      }
    }
    return objects;
  }
}
