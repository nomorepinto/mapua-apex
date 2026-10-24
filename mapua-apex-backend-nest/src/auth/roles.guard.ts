import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { mayAccessRole, type RouteRole } from '../common/caller.js';
import { IS_ARCUS, IS_PUBLIC, ROLES_KEY } from '../common/decorators.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const open =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true ||
      this.reflector.getAllAndOverride<boolean>(IS_ARCUS, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    if (open) {
      return true;
    }
    const roles = this.reflector.getAllAndOverride<RouteRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      throw new UnauthorizedException(
        'Unauthenticated: Bearer token is missing.',
      );
    }
    const caller = context.switchToHttp().getRequest<Request>().caller;
    if (!caller) {
      throw new UnauthorizedException(
        'Unauthenticated: Bearer token is missing.',
      );
    }
    const allowed = roles.some((role) =>
      mayAccessRole(role, caller.normalizedGroups),
    );
    if (!allowed) {
      const role = roles[0];
      throw new UnauthorizedException(
        `Unauthenticated: User is not in the required '${role}' or 'admin' Cognito group.`,
      );
    }
    return true;
  }
}
