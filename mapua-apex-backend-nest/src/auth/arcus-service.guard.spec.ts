import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { ArcusService } from '../common/decorators.js';
import { ArcusServiceGuard } from './arcus-service.guard.js';

class Probe {
  @ArcusService()
  events(): void {}

  plain(): void {}
}

describe('ArcusServiceGuard', () => {
  it('ignores routes that are not service routes', () => {
    const guard = new ArcusServiceGuard(new Reflector(), config('secret'));
    expect(guard.canActivate(context(Probe.prototype.plain, ''))).toBe(true);
  });

  it('is unavailable when the service token is not configured', () => {
    const guard = new ArcusServiceGuard(new Reflector(), config(''));
    expect(() =>
      guard.canActivate(context(Probe.prototype.events, 'secret')),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects a token that does not match', () => {
    const guard = new ArcusServiceGuard(new Reflector(), config('secret'));
    expect(() =>
      guard.canActivate(context(Probe.prototype.events, 'nope')),
    ).toThrow(UnauthorizedException);
  });
});

function config(token: string): { arcusServiceToken(): string } {
  return { arcusServiceToken: () => token };
}

function context(handler: () => void, token: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Probe,
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name === 'x-arcus-service-token' ? token : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}
