import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { Public, Roles } from '../common/decorators.js';
import { CognitoAuthGuard } from './cognito-auth.guard.js';
import type { JwtVerifier } from './jwt-verifier.js';

class Probe {
  @Roles('student')
  closed(): void {}

  @Roles('any')
  any(): void {}

  @Public()
  open(): void {}
}

const verifier: JwtVerifier = {
  async verify(token: string) {
    if (token === 'student') {
      return {
        sub: 's',
        email: 'a@mymail.mapua.edu.ph',
        'cognito:groups': ['student'],
        'custom:organization_id': 'org-1',
      };
    }
    if (token === 'admin') {
      return { sub: 's', 'cognito:groups': ['admin'] };
    }
    if (token === 'signatory') {
      return {
        sub: 's',
        'cognito:groups': ['signatory'],
        'custom:signatory_id': 'sig-1',
      };
    }
    return { sub: 's', 'cognito:groups': ['org_submitter'] };
  },
};

describe('CognitoAuthGuard', () => {
  const guard = new CognitoAuthGuard(new Reflector(), verifier);

  it('skips public routes', async () => {
    await expect(
      guard.canActivate(context(Probe.prototype.open, '')),
    ).resolves.toBe(true);
  });

  it('rejects a missing bearer token', async () => {
    await expect(
      guard.canActivate(context(Probe.prototype.closed, '')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a student route when the organization claim is missing', async () => {
    await expect(
      guard.canActivate(context(Probe.prototype.closed, 'Bearer signatory')),
    ).rejects.toThrow(
      'Unauthenticated: Missing custom:organization_id in Cognito token.',
    );
  });

  it('rejects an account that has neither a signatory id nor an organization id', async () => {
    await expect(
      guard.canActivate(context(Probe.prototype.any, 'Bearer unlinked')),
    ).rejects.toThrow(
      'Unauthenticated: Account must have a custom:signatory_id or custom:organization_id.',
    );
  });

  it('allows an admin account that has neither id', async () => {
    await expect(
      guard.canActivate(context(Probe.prototype.any, 'Bearer admin')),
    ).resolves.toBe(true);
  });

  it('allows an account that has a signatory id', async () => {
    await expect(
      guard.canActivate(context(Probe.prototype.any, 'Bearer signatory')),
    ).resolves.toBe(true);
  });

  it('allows a student account that has an organization id', async () => {
    await expect(
      guard.canActivate(context(Probe.prototype.closed, 'Bearer student')),
    ).resolves.toBe(true);
  });
});

function context(handler: () => void, authorization: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Probe,
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name === 'authorization' ? authorization : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}
