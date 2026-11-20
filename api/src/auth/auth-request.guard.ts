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

type Buckets = Map<string, { count: number; expires: number }>;

@Injectable()
export class AuthRequestGuard implements CanActivate {
  private readonly ipBuckets: Buckets = new Map();
  private readonly accountBuckets: Buckets = new Map();
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
    if (now >= this.nextSweep) {
      for (const buckets of [this.ipBuckets, this.accountBuckets]) {
        for (const [key, bucket] of buckets) {
          if (bucket.expires <= now) buckets.delete(key);
        }
      }
      this.nextSweep = now + minute;
    }
    const ip = request.ip ?? request.socket.remoteAddress;
    this.consume(this.ipBuckets, `${action}:${ip}`, 120, minute, now);
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
        this.accountBuckets,
        JSON.stringify([
          action,
          recovery ? null : ip,
          body.email.trim().toLowerCase(),
        ]),
        recovery ? 5 : 12,
        15 * minute,
        now,
      );
    }
    return true;
  }

  private consume(
    buckets: Buckets,
    key: string,
    limit: number,
    window: number,
    now: number,
  ) {
    const bucket = buckets.get(key);
    if (!bucket || bucket.expires <= now) {
      buckets.delete(key);
      if (buckets.size >= maxBuckets) {
        const oldest = buckets.keys().next();
        if (!oldest.done) buckets.delete(oldest.value);
      }
      buckets.set(key, { count: 1, expires: now + window });
      return;
    }
    if (bucket.count < limit) {
      bucket.count++;
      return;
    }
    throw new HttpException(
      'Too many authentication requests',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
