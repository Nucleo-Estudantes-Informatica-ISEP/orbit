import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { browserOrigins } from '../config/auth.config';

const minute = 60_000;
const maxBuckets = 10_000;

@Injectable()
export class AuthRequestGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { count: number; expires: number }
  >();
  private nextSweep = 0;

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get('origin');
    if (
      origin
        ? !browserOrigins().includes(origin)
        : request.get('sec-fetch-site') === 'cross-site'
    ) {
      throw new ForbiddenException('Untrusted authentication origin');
    }

    const action = context.getHandler().name;
    const now = Date.now();
    this.consume(
      `${action}:ip:${request.ip ?? request.socket.remoteAddress}`,
      120,
      minute,
      now,
    );
    const body: unknown = request.body;
    if (
      (action === 'login' || action === 'forgotPassword') &&
      body &&
      typeof body === 'object' &&
      'email' in body &&
      typeof body.email === 'string' &&
      body.email.length <= 254
    ) {
      const recovery = action === 'forgotPassword';
      this.consume(
        `${action}:email:${body.email.trim().toLowerCase()}`,
        recovery ? 5 : 12,
        15 * minute,
        now,
      );
    }
    return true;
  }

  private consume(key: string, limit: number, window: number, now: number) {
    if (now >= this.nextSweep) {
      for (const [bucketKey, bucket] of this.buckets) {
        if (bucket.expires <= now) this.buckets.delete(bucketKey);
      }
      this.nextSweep = now + minute;
    }
    const bucket = this.buckets.get(key);
    if (bucket && bucket.expires > now) {
      if (bucket.count++ < limit) return;
    } else if (bucket || this.buckets.size < maxBuckets) {
      this.buckets.set(key, { count: 1, expires: now + window });
      return;
    }
    throw new HttpException(
      'Too many authentication requests',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
