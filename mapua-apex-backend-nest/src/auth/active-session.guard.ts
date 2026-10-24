import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_ARCUS, IS_PUBLIC, SKIP_SESSION } from '../common/decorators.js';
import { SESSION_READER, type SessionReader } from './session-reader.js';

const STALE_MS = 15 * 60 * 1000;

/**
 * Enforces the active session on business routes. Missing `X-Session-ID` is 428
 * outside tests. A displaced, revoked, or stale session is 409 with the codes
 * the SPA listens for. A Dynamo failure fails open, matching Laravel.
 */
@Injectable()
export class ActiveSessionGuard implements CanActivate {
  private readonly logger = new Logger(ActiveSessionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(SESSION_READER)
    private readonly sessions: SessionReader | null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.skip(context) || !this.sessions) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const raw = request.header('x-session-id');
    const sessionId = typeof raw === 'string' ? raw.trim() : '';
    if (sessionId === '') {
      if (
        process.env.NODE_ENV === 'test' ||
        process.env.APP_ENV === 'testing'
      ) {
        return true;
      }
      throw new HttpException(
        { error: 'Active session required', code: 'SESSION_REQUIRED' },
        428,
      );
    }
    const caller = request.caller;
    if (!caller) {
      return true;
    }
    try {
      const pointer = await this.sessions.getActiveSessionPointer(caller.sub);
      if (!pointer) {
        return true;
      }
      if (pointer.session_id !== sessionId) {
        const item = await this.sessions.getSessionItem(sessionId);
        const reason = item?.end_reason ?? null;
        if (reason === 'concurrent_login') {
          throw sessionConflict(
            'This session was logged out because your account was logged into another device',
            'CONCURRENT_LOGIN_DISPLACED',
          );
        }
        if (reason === 'admin_revoked') {
          throw sessionConflict(
            'An administrator ended your session',
            'SESSION_REVOKED',
          );
        }
        throw sessionConflict('Session expired or replaced', 'SESSION_EXPIRED');
      }
      const last = pointer.last_heartbeat;
      if (last && Date.now() - Date.parse(last) > STALE_MS) {
        throw sessionConflict(
          'Session expired due to inactivity',
          'SESSION_EXPIRED',
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(
        `Session check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    return true;
  }

  private skip(context: ExecutionContext): boolean {
    const flags = [IS_PUBLIC, IS_ARCUS, SKIP_SESSION];
    return flags.some(
      (flag) =>
        this.reflector.getAllAndOverride<boolean>(flag, [
          context.getHandler(),
          context.getClass(),
        ]) === true,
    );
  }
}

function sessionConflict(error: string, code: string): HttpException {
  return new HttpException({ error, code }, HttpStatus.CONFLICT);
}
