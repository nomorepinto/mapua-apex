import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from './roles.guard.js';

class Closed {
  @Roles('student')
  student(): void {}
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('rejects a caller outside the route group', () => {
    expect(() =>
      guard.canActivate(
        context(Closed.prototype.student, { normalizedGroups: ['signatory'] }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('allows a matching group', () => {
    expect(
      guard.canActivate(
        context(Closed.prototype.student, { normalizedGroups: ['student'] }),
      ),
    ).toBe(true);
  });
});

function context(
  handler: () => void,
  caller: { normalizedGroups: string[] },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Closed,
    switchToHttp: () => ({ getRequest: () => ({ caller }) }),
  } as unknown as ExecutionContext;
}
