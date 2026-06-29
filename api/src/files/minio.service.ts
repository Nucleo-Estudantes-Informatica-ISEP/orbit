import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? 'orbit';
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'minio',
      port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Bucket "${this.bucket}" created.`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" already exists.`);
      }
    } catch (err) {
      this.logger.error('MinIO init failed — is MinIO running?', err);
    }
  }

  async uploadObject(
    objectKey: string,
    buffer: Buffer,
    mimeType: string,
    size: number,
  ): Promise<string> {
    await this.client.putObject(this.bucket, objectKey, buffer, size, {
      'Content-Type': mimeType,
    });
    return objectKey;
  }

  async getObject(objectKey: string): Promise<NodeJS.ReadableStream> {
    return this.client.getObject(this.bucket, objectKey);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  async getObjectStat(objectKey: string): Promise<Minio.BucketItemStat> {
    return this.client.statObject(this.bucket, objectKey);
  }
}
