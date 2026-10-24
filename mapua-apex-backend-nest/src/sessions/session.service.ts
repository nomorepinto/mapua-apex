import { createHash } from 'node:crypto';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import type { TransactOp } from '../aws/dynamo.port.js';
import { AppConfigService } from '../config/app-config.service.js';
import {
  activeSessionSk,
  nowIso,
  sessionGsi1,
  sessionKey,
  userKey,
} from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';
import { str } from '../common/records.js';
import type {
  ActiveSessionPointer,
  SessionReader,
  SessionRecord,
} from '../auth/session-reader.js';

const STALE_MS = 15 * 60 * 1000;
const MAX_PAGES = 200;
const METADATA = 'METADATA';

export interface SessionStartResult {
  sessionId: string;
  login_time: string;
  status: string;
  isNewSession: boolean;
  displacedPreviousSession: boolean;
}

@Injectable()
export class SessionService implements SessionReader {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly table: DynamoTable,
    private readonly config: AppConfigService,
  ) {}

  async getActiveSessionPointer(
    sub: string,
  ): Promise<ActiveSessionPointer | null> {
    const item = await this.table.get(
      userKey(sub),
      activeSessionSk(),
      this.sessions(),
    );
    if (!item || typeof item.session_id !== 'string') {
      return null;
    }
    return {
      session_id: item.session_id,
      last_heartbeat: str(item, 'last_heartbeat'),
    };
  }

  async getSessionItem(sessionId: string): Promise<SessionRecord | null> {
    const item = await this.table.get(
      sessionKey(sessionId),
      METADATA,
      this.sessions(),
    );
    if (!item) {
      return null;
    }
    return { end_reason: str(item, 'end_reason'), status: str(item, 'status') };
  }

  async start(input: {
    sub: string;
    authTime: number;
    userName: string;
    userEmail: string;
    userRole: string;
    ipAddress: string;
    userAgent: string;
    pagesVisited: Item[];
    existingSessionId: string | null;
    deviceId: string | null;
  }): Promise<SessionStartResult> {
    const pointer = await this.pointerItem(input.sub);
    const now = nowIso();
    if (pointer && typeof pointer.session_id === 'string') {
      const sameDevice =
        (input.deviceId !== null && pointer.device_id === input.deviceId) ||
        (input.existingSessionId !== null &&
          input.existingSessionId === pointer.session_id);
      if (sameDevice) {
        const reused = await this.reuse(
          pointer.session_id,
          input.sub,
          input.pagesVisited,
          now,
        );
        if (reused) {
          return reused;
        }
      } else {
        const displaced = await this.displace(pointer.session_id, input, now);
        if (displaced) {
          return displaced;
        }
      }
    }
    return this.createFresh(input, now);
  }

  async heartbeat(
    sessionId: string,
    sub: string,
    pages: Item[],
  ): Promise<Item> {
    const item = await this.table.get(
      sessionKey(sessionId),
      METADATA,
      this.sessions(),
    );
    if (!item) {
      throw sessionError('Session expired or invalid', 'SESSION_EXPIRED', 409);
    }
    if (str(item, 'sub') !== sub) {
      throw new HttpException({ error: 'Forbidden: Session ID mismatch' }, 403);
    }
    const pointer = await this.pointerItem(sub);
    if (pointer && pointer.session_id !== sessionId) {
      const fresh =
        typeof pointer.last_heartbeat === 'string' &&
        !this.staleStamp(pointer.last_heartbeat);
      const sameDevice =
        typeof item.device_id === 'string' &&
        typeof pointer.device_id === 'string' &&
        item.device_id === pointer.device_id;
      if (fresh && !sameDevice) {
        if (str(item, 'status') === 'active') {
          await this.close(sessionId, item, 'concurrent_login');
        }
        if (str(item, 'end_reason') === 'admin_revoked') {
          throw sessionError(
            'An administrator ended your session',
            'SESSION_REVOKED',
            409,
          );
        }
        throw sessionError(
          'This session was logged out because your account was logged into another device',
          'CONCURRENT_LOGIN_DISPLACED',
          409,
        );
      }
    }
    if (str(item, 'status') === 'active' && this.stale(item)) {
      await this.close(sessionId, item, 'timed_out');
      await this.clearPointer(sub, sessionId);
      throw sessionError('Session expired or invalid', 'SESSION_EXPIRED', 409);
    }
    if (str(item, 'status') !== 'active') {
      if (str(item, 'end_reason') === 'concurrent_login') {
        throw sessionError(
          'This session was logged out because your account was logged into another device',
          'CONCURRENT_LOGIN_DISPLACED',
          409,
        );
      }
      if (str(item, 'end_reason') === 'admin_revoked') {
        throw sessionError(
          'An administrator ended your session',
          'SESSION_REVOKED',
          409,
        );
      }
      throw sessionError('Session expired or invalid', 'SESSION_EXPIRED', 409);
    }
    await this.touch(
      sessionId,
      sub,
      item,
      pages,
      pointer?.session_id === sessionId,
    );
    return { sessionId, status: 'active' };
  }

  async end(sessionId: string, sub: string, reason: string): Promise<Item> {
    const item = await this.table.get(
      sessionKey(sessionId),
      METADATA,
      this.sessions(),
    );
    if (!item) {
      throw new HttpException({ error: 'Session not found' }, 404);
    }
    if (str(item, 'sub') !== sub) {
      throw new HttpException({ error: 'Forbidden: Session ID mismatch' }, 403);
    }
    if (str(item, 'status') === 'active') {
      await this.close(sessionId, item, reason || 'logout');
      await this.clearPointer(sub, sessionId);
    }
    return { sessionId, status: 'completed' };
  }

  private async reuse(
    sessionId: string,
    sub: string,
    pages: Item[],
    now: string,
  ): Promise<SessionStartResult | null> {
    const item = await this.table.get(
      sessionKey(sessionId),
      METADATA,
      this.sessions(),
    );
    if (!item || str(item, 'status') !== 'active') {
      return null;
    }
    if (this.stale(item)) {
      await this.close(sessionId, item, 'timed_out');
      await this.clearPointer(sub, sessionId);
      return null;
    }
    await this.touch(sessionId, sub, item, pages, true);
    return {
      sessionId,
      login_time: str(item, 'login_time') ?? now,
      status: 'active',
      isNewSession: false,
      displacedPreviousSession: false,
    };
  }

  private async displace(
    oldSessionId: string,
    input: Parameters<SessionService['start']>[0],
    now: string,
  ): Promise<SessionStartResult | null> {
    const old = await this.table.get(
      sessionKey(oldSessionId),
      METADATA,
      this.sessions(),
    );
    if (old && str(old, 'status') === 'active' && this.stale(old)) {
      await this.close(oldSessionId, old, 'timed_out');
      await this.clearPointer(input.sub, oldSessionId);
      return null;
    }
    const sessionId = await this.availableId(
      this.base(input.sub, input.authTime),
    );
    const created = this.sessionItem(sessionId, input, now);
    const pointerSet: Record<string, unknown> = {
      session_id: sessionId,
      status: 'active',
      login_time: now,
      last_heartbeat: now,
      TTL: this.ttl(),
    };
    if (input.deviceId) {
      pointerSet.device_id = input.deviceId;
    }
    const ops: TransactOp[] = [
      {
        kind: 'update' as const,
        key: { PK: userKey(input.sub), SK: activeSessionSk() },
        set: pointerSet,
        condition: 'session_id = :oldSid',
        values: { ':oldSid': oldSessionId },
      },
      {
        kind: 'put' as const,
        item: created,
        condition: 'attribute_not_exists(PK)',
      },
    ];
    const displaced = Boolean(old && str(old, 'status') === 'active');
    if (displaced && old) {
      ops.push({
        kind: 'update',
        key: { PK: sessionKey(oldSessionId), SK: METADATA },
        set: {
          status: 'completed',
          end_reason: 'concurrent_login',
          logout_time: now,
          duration_seconds: duration(str(old, 'login_time'), now),
          GSI3PK: 'STATUS#completed',
          GSI3SK: now,
        },
        condition: '#status = :active',
        names: { '#status': 'status' },
        values: { ':active': 'active' },
      });
    }
    try {
      await this.table.transact(ops, this.sessions());
    } catch (error) {
      this.logger.warn(
        `Session displace failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      throw error;
    }
    return {
      sessionId,
      login_time: now,
      status: 'active',
      isNewSession: true,
      displacedPreviousSession: displaced,
    };
  }

  private async createFresh(
    input: Parameters<SessionService['start']>[0],
    now: string,
  ): Promise<SessionStartResult> {
    const sessionId = await this.availableId(
      this.base(input.sub, input.authTime),
    );
    const created = this.sessionItem(sessionId, input, now);
    const pointer: Item = {
      PK: userKey(input.sub),
      SK: activeSessionSk(),
      sub: input.sub,
      session_id: sessionId,
      status: 'active',
      login_time: now,
      last_heartbeat: now,
      TTL: this.ttl(),
      ...(input.deviceId ? { device_id: input.deviceId } : {}),
    };
    await this.table.transact(
      [
        { kind: 'put', item: created, condition: 'attribute_not_exists(PK)' },
        { kind: 'put', item: pointer, condition: 'attribute_not_exists(PK)' },
      ],
      this.sessions(),
    );
    return {
      sessionId,
      login_time: now,
      status: 'active',
      isNewSession: true,
      displacedPreviousSession: false,
    };
  }

  private sessionItem(
    sessionId: string,
    input: Parameters<SessionService['start']>[0],
    now: string,
  ): Item {
    const [pages, truncated] = appendPages([], input.pagesVisited, false);
    return {
      PK: sessionKey(sessionId),
      SK: METADATA,
      session_id: sessionId,
      sub: input.sub,
      user_name: input.userName,
      user_email: input.userEmail,
      user_role: input.userRole,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      device_info: { user_agent: input.userAgent },
      status: 'active',
      login_time: now,
      logout_time: null,
      last_heartbeat: now,
      duration_seconds: 0,
      pages_visited: pages,
      pages_visited_truncated: truncated,
      events_count: input.pagesVisited.length,
      end_reason: null,
      revocation_reason: null,
      TTL: this.ttl(),
      GSI1PK: sessionGsi1(now.slice(0, 7)),
      GSI1SK: now,
      GSI2PK: userKey(input.sub),
      GSI2SK: now,
      GSI3PK: 'STATUS#active',
      GSI3SK: now,
      ...(input.deviceId ? { device_id: input.deviceId } : {}),
    };
  }

  private async touch(
    sessionId: string,
    sub: string,
    item: Item,
    pages: Item[],
    updatePointer: boolean,
  ): Promise<void> {
    const now = nowIso();
    const [nextPages, truncated] = appendPages(
      Array.isArray(item.pages_visited) ? (item.pages_visited as Item[]) : [],
      pages,
      item.pages_visited_truncated === true,
    );
    const set: Record<string, unknown> = {
      last_heartbeat: now,
      duration_seconds: duration(str(item, 'login_time'), now),
      GSI3SK: now,
    };
    if (pages.length > 0) {
      set.pages_visited = nextPages;
      set.pages_visited_truncated = truncated;
      set.events_count =
        (typeof item.events_count === 'number' ? item.events_count : 0) +
        pages.length;
    }
    await this.table.update({
      table: this.sessions(),
      key: { PK: sessionKey(sessionId), SK: METADATA },
      set,
    });
    if (updatePointer) {
      await this.table.update({
        table: this.sessions(),
        key: { PK: userKey(sub), SK: activeSessionSk() },
        set: { last_heartbeat: now },
      });
    }
  }

  private async close(
    sessionId: string,
    item: Item,
    reason: string,
  ): Promise<void> {
    const status =
      reason === 'timed_out' || reason === 'timeout'
        ? 'timed_out'
        : reason === 'revoked'
          ? 'revoked'
          : 'completed';
    const logout =
      status === 'timed_out' || status === 'revoked'
        ? (str(item, 'last_heartbeat') ?? nowIso())
        : nowIso();
    await this.table.update({
      table: this.sessions(),
      key: { PK: sessionKey(sessionId), SK: METADATA },
      set: {
        status,
        logout_time: logout,
        duration_seconds: duration(str(item, 'login_time'), logout),
        end_reason: reason,
        GSI3PK: `STATUS#${status}`,
        GSI3SK: logout,
      },
    });
  }

  private async clearPointer(sub: string, sessionId: string): Promise<void> {
    try {
      await this.table.delete(userKey(sub), activeSessionSk(), this.sessions());
    } catch (error) {
      this.logger.warn(
        `Pointer clear skipped for ${sessionId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private async pointerItem(sub: string): Promise<Item | undefined> {
    return this.table.get(userKey(sub), activeSessionSk(), this.sessions());
  }

  private async availableId(base: string): Promise<string> {
    for (let n = 0; n <= 10; n += 1) {
      const candidate = n === 0 ? base : `${base}#${n + 1}`;
      const existing = await this.table.get(
        sessionKey(candidate),
        METADATA,
        this.sessions(),
      );
      if (!existing) {
        return candidate;
      }
    }
    return `${base}#${Date.now()}`;
  }

  private base(sub: string, authTime: number): string {
    return createHash('sha256').update(`${sub}:${authTime}`).digest('hex');
  }

  private stale(item: Item): boolean {
    const last = str(item, 'last_heartbeat');
    return !last || this.staleStamp(last);
  }

  private staleStamp(value: string): boolean {
    return Date.now() - Date.parse(value) > STALE_MS;
  }

  private ttl(): number {
    return (
      Math.floor(Date.now() / 1000) + this.config.logRetentionDays() * 86400
    );
  }

  private sessions(): string {
    return this.config.sessionLogTable();
  }
}

function duration(login: string | null, end: string): number {
  if (!login) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.parse(end) - Date.parse(login)) / 1000));
}

function appendPages(
  existing: Item[],
  incoming: Item[],
  truncated: boolean,
): [Item[], boolean] {
  if (truncated || incoming.length === 0) {
    return [existing, truncated];
  }
  const pages = [...existing];
  let last =
    pages.length > 0 ? String(pages[pages.length - 1]?.path ?? '') : '';
  for (const page of incoming) {
    if (pages.length >= MAX_PAGES) {
      return [pages, true];
    }
    const path = String(page.path ?? '');
    if (path === last) {
      continue;
    }
    pages.push(page);
    last = path;
  }
  return [pages, false];
}

function sessionError(
  error: string,
  code: string,
  status: number,
): HttpException {
  return new HttpException({ error, code }, status);
}
