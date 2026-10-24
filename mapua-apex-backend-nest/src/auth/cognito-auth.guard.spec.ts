import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { Public, Roles } from '../common/decorators.js';
import { CognitoAuthGuard } from './cognito-auth.guard.js';
import type { JwtVerifier } from './jwt-verifier.js';

class Probe {
  @Roles('student')
  closed(): void {}

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
    return { sub: 's', 'cognito:groups': ['signatory'] };
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
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
