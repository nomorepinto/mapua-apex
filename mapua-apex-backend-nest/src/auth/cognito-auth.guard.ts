import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { stripPrefix } from '../common/dynamo-keys.js';
import {
  deriveUserRole,
  type AuthenticatedCaller,
  type RouteRole,
} from '../common/caller.js';
import { IS_ARCUS, IS_PUBLIC, ROLES_KEY } from '../common/decorators.js';
import { JWT_VERIFIER, type JwtVerifier } from './jwt-verifier.js';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.skip(context)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header('authorization') ?? '';
    const token = header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : '';
    if (token === '') {
      throw new UnauthorizedException(
        'Unauthenticated: Bearer token is missing.',
      );
    }
    const claims = await this.verifier.verify(token);
    const groups = readGroups(claims['cognito:groups']);
    const normalizedGroups = groups.map((group) => group.toLowerCase());
    const isAdmin =
      normalizedGroups.includes('admin') ||
      normalizedGroups.includes('super_admin');
    const mayImpersonateSignatory =
      isAdmin || normalizedGroups.includes('osaar');
    const userRole = deriveUserRole(normalizedGroups, isAdmin);
    const caller: AuthenticatedCaller = {
      sub: stringClaim(claims, 'sub') ?? 'unknown',
      email: stringClaim(claims, 'email') ?? 'unknown@mapua.edu.ph',
      name:
        stringClaim(claims, 'name') ??
        stringClaim(claims, 'email') ??
        'Unknown User',
      role: stringClaim(claims, 'custom:role') ?? userRole,
      groups,
      normalizedGroups,
      isAdmin,
      mayImpersonateSignatory,
      organizationId: this.scopedId(
        claims,
        ['custom:organization_id', 'organization_id'],
        request.header('x-organization-id'),
        'ORGANIZATION#',
        isAdmin,
      ),
      signatoryId: this.scopedId(
        claims,
        ['custom:signatory_id', 'signatory_id'],
        request.header('x-signatory-id'),
        'SIGNATORY#',
        mayImpersonateSignatory,
      ),
      claims,
      tokenUse: stringClaim(claims, 'token_use'),
    };
    request.caller = caller;
    this.requireScope(context, caller);
    return true;
  }

  private skip(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true ||
      this.reflector.getAllAndOverride<boolean>(IS_ARCUS, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private requireScope(
    context: ExecutionContext,
    caller: AuthenticatedCaller,
  ): void {
    const roles =
      this.reflector.getAllAndOverride<RouteRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (
      roles.includes('student') &&
      !caller.isAdmin &&
      !caller.organizationId
    ) {
      throw new UnauthorizedException(
        'Unauthenticated: Missing custom:organization_id in Cognito token.',
      );
    }
    if (
      roles.includes('signatory') &&
      !caller.mayImpersonateSignatory &&
      !caller.signatoryId
    ) {
      throw new UnauthorizedException(
        'Unauthenticated: Missing custom:signatory_id in Cognito token.',
      );
    }
  }

  private scopedId(
    claims: Record<string, unknown>,
    keys: string[],
    header: string | undefined,
    prefix: string,
    allowHeader: boolean,
  ): string | null {
    for (const key of keys) {
      const value = stringClaim(claims, key);
      if (value) {
        return stripPrefix(value, prefix);
      }
    }
    if (allowHeader && header && header !== '') {
      return stripPrefix(header, prefix);
    }
    return null;
  }
}

function stringClaim(
  claims: Record<string, unknown>,
  key: string,
): string | null {
  const value = claims[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function readGroups(value: unknown): string[] {
  if (typeof value === 'string' && value !== '') {
    return [value];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (group): group is string => typeof group === 'string' && group !== '',
  );
}
