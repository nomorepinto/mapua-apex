import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { IS_ARCUS } from '../common/decorators.js';

@Injectable()
export class ArcusServiceGuard implements CanActivate {
  private readonly logger = new Logger(ArcusServiceGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(IS_ARCUS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required !== true) {
      return true;
    }
    const expected = this.config.arcusServiceToken();
    const request = context.switchToHttp().getRequest<Request>();
    if (expected === '') {
      this.logger.warn(
        'Arcus service call rejected: ARCUS_SERVICE_TOKEN is not configured.',
      );
      throw new ServiceUnavailableException(
        'Arcus service integration is not configured.',
      );
    }
    const provided = request.header('x-arcus-service-token') ?? '';
    if (provided === '' || !safeEqual(expected, provided)) {
      this.logger.warn(
        'Arcus service call rejected: bad or missing service token.',
      );
      throw new UnauthorizedException(
        'Unauthenticated: invalid arcus service token.',
      );
    }
    const organization = request.header('x-arcus-organization-id');
    request.arcusOrganizationId =
      organization && organization !== ''
        ? stripPrefix(organization, 'ORGANIZATION#')
        : null;
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
