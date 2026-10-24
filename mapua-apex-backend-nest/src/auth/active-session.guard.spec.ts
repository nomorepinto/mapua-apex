import { HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { ActiveSessionGuard } from './active-session.guard.js';
import type { SessionReader } from './session-reader.js';

describe('ActiveSessionGuard', () => {
  const reader: SessionReader = {
    async getActiveSessionPointer() {
      return {
        session_id: 'current',
        last_heartbeat: new Date().toISOString(),
      };
    },
    async getSessionItem() {
      return { end_reason: 'concurrent_login', status: 'completed' };
    },
  };

  it('requires a session header outside tests', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ENV;
    const guard = new ActiveSessionGuard(new Reflector(), reader);
    await expect(guard.canActivate(context(''))).rejects.toBeInstanceOf(
      HttpException,
    );
    process.env.NODE_ENV = previous;
  });

  it('returns the displaced code when the header is not the active session', async () => {
    const previousNode = process.env.NODE_ENV;
    const previousApp = process.env.APP_ENV;
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    const guard = new ActiveSessionGuard(new Reflector(), reader);
    await expect(guard.canActivate(context('old'))).rejects.toMatchObject({
      response: { code: 'CONCURRENT_LOGIN_DISPLACED' },
    });
    process.env.NODE_ENV = previousNode;
    process.env.APP_ENV = previousApp;
  });
});

function context(sessionId: string): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Probe {},
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name === 'x-session-id' ? sessionId : undefined,
        caller: { sub: 'student-sub' },
      }),
    }),
  } as unknown as ExecutionContext;
}
