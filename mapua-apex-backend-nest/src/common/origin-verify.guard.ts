import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service.js';

/**
 * CloudFront sends `X-Origin-Verify`. When the secret is unset (local, tests)
 * the check is skipped. A mismatch is 403 so the Function URL cannot bypass WAF.
 */
@Injectable()
export class OriginVerifyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.originVerifySecret();
    if (expected === '') {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-origin-verify') ?? '';
    if (provided === '' || !safeEqual(expected, provided)) {
      throw new ForbiddenException('Forbidden.');
    }
    return true;
  }
}

function safeEqual(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
