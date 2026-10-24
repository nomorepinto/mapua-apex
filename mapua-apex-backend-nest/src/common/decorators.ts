import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ADMIN_DEFAULT_ORGANIZATION_ID,
  ADMIN_DEFAULT_SIGNATORY_ID,
  type AuthenticatedCaller,
  type RouteRole,
} from './caller.js';

export const IS_PUBLIC = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC, true);

export const IS_ARCUS = 'isArcus';
export const ArcusService = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_ARCUS, true);

export const NO_ENVELOPE = 'noEnvelope';
export const NoEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(NO_ENVELOPE, true);

export const SKIP_SESSION = 'skipSession';
export const SkipSession = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_SESSION, true);

export const ROLES_KEY = 'roles';
export const Roles = (
  ...roles: RouteRole[]
): ClassDecorator & MethodDecorator => SetMetadata(ROLES_KEY, roles);

export function requestOf(context: ExecutionContext): Request {
  return context.switchToHttp().getRequest<Request>();
}

export const CurrentCaller = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedCaller => {
    const caller = requestOf(context).caller;
    if (!caller) {
      throw new UnauthorizedException(
        'Unauthenticated: Bearer token is missing.',
      );
    }
    return caller;
  },
);

export const OrganizationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const caller = requestOf(context).caller;
    if (!caller) {
      throw new UnauthorizedException(
        'Unauthenticated: Bearer token is missing.',
      );
    }
    if (caller.organizationId) {
      return caller.organizationId;
    }
    if (caller.isAdmin) {
      return ADMIN_DEFAULT_ORGANIZATION_ID;
    }
    throw new UnauthorizedException(
      'Unauthenticated: Missing custom:organization_id in Cognito token.',
    );
  },
);

export const SignatoryId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const caller = requestOf(context).caller;
    if (!caller) {
      throw new UnauthorizedException(
        'Unauthenticated: Bearer token is missing.',
      );
    }
    if (caller.signatoryId) {
      return caller.signatoryId;
    }
    if (caller.isAdmin) {
      return ADMIN_DEFAULT_SIGNATORY_ID;
    }
    throw new UnauthorizedException(
      'Unauthenticated: Missing cognito.signatory_id in Cognito claims or X-Signatory-Id request header.',
    );
  },
);

export const ArcusOrganizationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    return requestOf(context).arcusOrganizationId ?? null;
  },
);
