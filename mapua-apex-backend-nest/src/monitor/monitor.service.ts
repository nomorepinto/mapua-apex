import { HttpException, Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import { AppConfigService } from '../config/app-config.service.js';
import { sessionGsi1, sessionKey } from '../common/dynamo-keys.js';
import { manilaDate } from '../common/manila.js';
import { str, type Item } from '../common/records.js';

export interface MonitorPage {
  data: Item[];
  nextToken: string | null;
}

@Injectable()
export class MonitorService {
  constructor(
    private readonly table: DynamoTable,
    private readonly config: AppConfigService,
  ) {}

  async sessions(query: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    role?: string;
    status?: string;
    limit?: string;
  }): Promise<MonitorPage> {
    const { start, end, limit } = range(
      query.startDate,
      query.endDate,
      query.limit,
    );
    const buckets = monthsBetween(start, end);
    const items: Item[] = [];
    for (const bucket of buckets) {
      const rows = await this.table.query({
        table: this.config.sessionLogTable(),
        index: 'GSI1',
        keyCondition: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
        values: {
          ':pk': sessionGsi1(bucket),
          ':start': `${start}T00:00:00Z`,
          ':end': `${end}T23:59:59Z`,
        },
        scanForward: false,
        limit,
      });
      for (const row of rows) {
        if (query.userId && str(row, 'sub') !== query.userId) {
          continue;
        }
        if (query.role && str(row, 'user_role') !== query.role) {
          continue;
        }
        if (query.status && str(row, 'status') !== query.status) {
          continue;
        }
        items.push(publicSession(row));
      }
    }
    items.sort((left, right) =>
      String(right.login_time).localeCompare(String(left.login_time)),
    );
    return page(items, limit);
  }

  async session(id: string): Promise<Item> {
    const item = await this.table.get(
      sessionKey(id),
      'METADATA',
      this.config.sessionLogTable(),
    );
    if (!item) {
      throw new HttpException({ error: 'Session log record not found' }, 404);
    }
    return publicSession(item);
  }

  async activity(query: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    role?: string;
    actionType?: string;
    module?: string;
    limit?: string;
  }): Promise<MonitorPage> {
    const { start, end, limit } = range(
      query.startDate,
      query.endDate,
      query.limit,
    );
    const items: Item[] = [];
    for (const date of datesBetween(start, end)) {
      const rows = await this.table.query({
        table: this.config.activityLogTable(),
        index: 'GSI3',
        keyCondition: 'GSI3PK = :pk',
        values: { ':pk': `DATE#${date}` },
        scanForward: false,
        limit,
      });
      for (const row of rows) {
        if (query.userId && str(row, 'userId') !== query.userId) {
          continue;
        }
        if (query.role && str(row, 'userRole') !== query.role) {
          continue;
        }
        if (query.module && str(row, 'module') !== query.module) {
          continue;
        }
        if (
          query.actionType &&
          !actionMatches(str(row, 'actionType') ?? '', query.actionType)
        ) {
          continue;
        }
        items.push(row);
      }
    }
    items.sort((left, right) =>
      String(right.timestamp).localeCompare(String(left.timestamp)),
    );
    return page(items, limit);
  }

  async activityItem(activityId: string): Promise<Item> {
    const pk = activityId.startsWith('ACTIVITY#')
      ? activityId
      : `ACTIVITY#${activityId}`;
    const item = await this.table.get(pk, pk, this.config.activityLogTable());
    if (!item) {
      throw new HttpException({ error: 'Activity log record not found' }, 404);
    }
    return item;
  }

  async stats(): Promise<Item> {
    const today = manilaDate();
    const sessions = await this.sessions({
      startDate: today,
      endDate: today,
      limit: '1000',
    });
    const activity = await this.activity({
      startDate: today,
      endDate: today,
      limit: '1000',
    });
    const roleDistribution: Record<string, number> = {};
    let active = 0;
    for (const row of sessions.data) {
      const role = str(row, 'user_role') ?? 'unknown';
      roleDistribution[role] = (roleDistribution[role] ?? 0) + 1;
      if (str(row, 'status') === 'active') {
        active += 1;
      }
    }
    return {
      activeSessionsCount: active,
      totalSessionsToday: sessions.data.length,
      totalActivityToday: activity.data.length,
      roleDistribution,
    };
  }
}

function publicSession(item: Item): Item {
  return {
    session_id: str(item, 'session_id'),
    sub: str(item, 'sub'),
    user_name: str(item, 'user_name'),
    user_email: str(item, 'user_email'),
    user_role: str(item, 'user_role'),
    ip_address: str(item, 'ip_address'),
    device_info: item.device_info ?? null,
    status: str(item, 'status'),
    login_time: str(item, 'login_time'),
    logout_time: str(item, 'logout_time'),
    last_heartbeat: str(item, 'last_heartbeat'),
    duration_seconds: item.duration_seconds ?? 0,
    pages_visited: item.pages_visited ?? [],
    events_count: item.events_count ?? 0,
    revocation_reason: str(item, 'revocation_reason'),
  };
}

function page(items: Item[], limit: number): MonitorPage {
  return {
    data: items.slice(0, limit),
    nextToken: items.length > limit ? 'more' : null,
  };
}

function range(
  startRaw: string | undefined,
  endRaw: string | undefined,
  limitRaw: string | undefined,
): {
  start: string;
  end: string;
  limit: number;
} {
  const today = manilaDate();
  let start =
    startRaw && /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : today;
  let end = endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? endRaw : today;
  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }
  const parsed = Number.parseInt(limitRaw ?? '50', 10);
  const limit = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), 200)
    : 50;
  return { start, end, limit };
}

function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  let cursor = start;
  while (cursor <= end && months.length < 24) {
    const month = cursor.slice(0, 7);
    if (!months.includes(month)) {
      months.push(month);
    }
    cursor = nextDate(cursor);
  }
  return months;
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < 62) {
    dates.push(cursor);
    cursor = nextDate(cursor);
  }
  return dates;
}

function nextDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function actionMatches(actual: string, target: string): boolean {
  const left = actual.toUpperCase();
  const right = target.trim().toUpperCase();
  return (
    left === right ||
    left.includes(right) ||
    right.includes(left) ||
    (right === 'APPROVED' && left.includes('APPROVE')) ||
    (right === 'RETURNED' && left.includes('RETURN')) ||
    (right === 'DENIED' && left.includes('DENY'))
  );
}
