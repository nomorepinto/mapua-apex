import { HttpException, Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import { AppConfigService } from '../config/app-config.service.js';
import { sessionKey } from '../common/dynamo-keys.js';
import { MonitorRepository } from './monitor.repository.js';
import {
  generateReport,
  invalidReport,
  parseFilters,
  type ReportFilters,
} from '../common/reporting.js';
import { withReportBudget } from '../common/report-budget.js';
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
    private readonly repository: MonitorRepository,
  ) {}

  async sessions(
    query: Record<string, string | undefined>,
    scope = '',
  ): Promise<MonitorPage> {
    return this.list('sessions', query, scope);
  }

  private async list(
    kind: 'sessions' | 'activity',
    query: Record<string, string | undefined>,
    scope: string,
  ): Promise<MonitorPage> {
    const filters = monitorFilters(kind, query);
    const limit = Number(query.limit ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200)
      invalidReport('limit must be between 1 and 200.');
    return withReportBudget(async () => {
      const page = await this.repository.page(
        kind,
        filters,
        limit,
        query.nextToken,
        scope,
      );
      return {
        ...page,
        data: page.data.map(
          kind === 'sessions' ? publicSession : publicActivity,
        ),
      };
    });
  }

  report(
    kind: 'sessions' | 'activity',
    input: unknown,
    scope: string,
  ): Promise<Item> {
    return generateReport(
      kind,
      input,
      scope,
      (filters) => this.repository.all(kind, filters),
      this.config.logRetentionDays(),
    );
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

  async activity(
    query: Record<string, string | undefined>,
    scope = '',
  ): Promise<MonitorPage> {
    return this.list('activity', query, scope);
  }

  async activityItem(activityId: string): Promise<Item> {
    const pk = activityId.startsWith('ACTIVITY#')
      ? activityId
      : `ACTIVITY#${activityId}`;
    const item = await this.table.get(pk, pk, this.config.activityLogTable());
    if (!item) {
      throw new HttpException({ error: 'Activity log record not found' }, 404);
    }
    return publicActivity(item);
  }

  async stats(): Promise<Item> {
    const today = manilaDate();
    return withReportBudget(async () => {
      const filters = { start_date: today, end_date: today };
      const roleDistribution: Record<string, number> = {};
      let active = 0;
      let sessions = 0;
      let activity = 0;
      for await (const row of this.repository.all('sessions', filters)) {
        sessions++;
        const role = str(row, 'user_role') ?? 'unknown';
        roleDistribution[role] = (roleDistribution[role] ?? 0) + 1;
        if (str(row, 'status') === 'active') active++;
      }
      for await (const _row of this.repository.all('activity', filters))
        activity++;
      return {
        activeSessionsCount: active,
        totalSessionsToday: sessions,
        totalActivityToday: activity,
        roleDistribution,
      };
    });
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
    end_reason: str(item, 'end_reason'),
    pages_visited_truncated: item.pages_visited_truncated === true,
  };
}

function publicActivity(item: Item): Item {
  return Object.fromEntries(
    [
      'activityId',
      'sessionId',
      'userId',
      'userName',
      'userEmail',
      'userRole',
      'timestamp',
      'actionType',
      'module',
      'entityId',
      'eventId',
      'entityName',
      'organizationId',
      'organizationName',
      'description',
    ].map((key) => [key, item[key] ?? null]),
  );
}

function monitorFilters(
  kind: 'sessions' | 'activity',
  query: Record<string, string | undefined>,
): ReportFilters {
  if (query.filters) {
    try {
      return parseFilters(kind, JSON.parse(query.filters) as unknown);
    } catch (error) {
      if (error instanceof SyntaxError) invalidReport('Invalid filters JSON.');
      throw error;
    }
  }
  const values: Record<string, string[]> = {};
  if (query.userId) values.actor_id = [query.userId];
  if (query.role) values.role = [query.role];
  if (kind === 'sessions' && query.status) values.status = [query.status];
  if (kind === 'activity' && query.module) values.module = [query.module];
  if (kind === 'activity' && query.actionType) {
    const aliases: Record<string, string> = {
      APPROVED: 'SUBMISSION_APPROVE',
      RETURNED: 'SUBMISSION_RETURN',
      DENIED: 'SUBMISSION_DENY',
      SUBMITTED: 'SUBMISSION_CREATE',
    };
    values.action = [
      aliases[query.actionType.toUpperCase()] ?? query.actionType,
    ];
  }
  return parseFilters(kind, {
    start_date: query.startDate ?? manilaDate(),
    end_date: query.endDate ?? manilaDate(),
    values,
    sort: query.sort ?? 'desc',
  });
}
