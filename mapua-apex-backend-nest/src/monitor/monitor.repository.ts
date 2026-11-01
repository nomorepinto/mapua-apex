import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import { AppConfigService } from '../config/app-config.service.js';
import {
  invalidReport,
  matchesValues,
  reportRow,
  type ReportFilters,
} from '../common/reporting.js';
import { record, type Item } from '../common/records.js';

interface Cursor {
  version: number;
  fingerprint: string;
  bucket: number;
  cutoff: string;
  key?: Item;
}
export interface LogPage {
  data: Item[];
  nextToken: string | null;
}

@Injectable()
export class MonitorRepository {
  constructor(
    private readonly table: DynamoTable,
    private readonly config: AppConfigService,
  ) {}

  async page(
    kind: 'sessions' | 'activity',
    filters: ReportFilters,
    limit: number,
    token?: string,
    scope = '',
  ): Promise<LogPage> {
    const start = new Date(
      `${filters.start_date}T00:00:00+08:00`,
    ).toISOString();
    const end = new Date(
      Date.parse(`${filters.end_date}T00:00:00+08:00`) + 86_400_000,
    ).toISOString();
    const buckets: string[] = [];
    for (
      let ts = Date.parse(start.slice(0, 10));
      ts < Date.parse(end);
      ts += 86_400_000
    ) {
      const value = new Date(ts)
        .toISOString()
        .slice(0, kind === 'sessions' ? 7 : 10);
      if (!buckets.includes(value)) buckets.push(value);
    }
    if (filters.sort !== 'asc') buckets.reverse();
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ kind, filters, scope }))
      .digest('hex');
    let cursor: Cursor = {
      version: 1,
      fingerprint,
      bucket: 0,
      cutoff: new Date().toISOString(),
    };
    if (token) {
      try {
        if (token.length > 4096) invalidReport('Invalid continuation token.');
        const decoded = record(
          JSON.parse(
            Buffer.from(token, 'base64url').toString('utf8'),
          ) as unknown,
        );
        if (
          !decoded ||
          decoded.version !== 1 ||
          decoded.fingerprint !== fingerprint ||
          !Number.isInteger(decoded.bucket) ||
          Number(decoded.bucket) < 0 ||
          Number(decoded.bucket) >= buckets.length ||
          typeof decoded.cutoff !== 'string' ||
          !Number.isFinite(Date.parse(decoded.cutoff)) ||
          Date.parse(decoded.cutoff) > Date.now()
        )
          invalidReport('Continuation token does not match these filters.');
        cursor = decoded as unknown as Cursor;
        if (cursor.key) {
          const key = record(cursor.key);
          const prefix = kind === 'sessions' ? 'SESSION#' : 'ACTIVITY#';
          const index = kind === 'sessions' ? 'GSI1' : 'GSI3';
          const partition =
            kind === 'sessions'
              ? `LOG#SESSION#${buckets[cursor.bucket]}`
              : `DATE#${buckets[cursor.bucket]}`;
          if (
            !key ||
            typeof key.PK !== 'string' ||
            !key.PK.startsWith(prefix) ||
            typeof key.SK !== 'string' ||
            key[`${index}PK`] !== partition ||
            typeof key[`${index}SK`] !== 'string' ||
            Object.keys(key).some(
              (k) => !['PK', 'SK', `${index}PK`, `${index}SK`].includes(k),
            )
          )
            invalidReport('Invalid continuation key.');
        }
      } catch {
        invalidReport('Invalid continuation token.');
      }
    }
    const data: Item[] = [];
    const startTime = Date.parse(start);
    const endTime = Date.parse(end);
    const cutoffTime = Date.parse(cursor.cutoff);
    if (startTime > cutoffTime) return { data, nextToken: null };
    // Index timestamps may have seconds or milliseconds precision. Query a
    // superset using second prefixes, then enforce exact numeric boundaries.
    const lowerKey = start.slice(0, 19);
    const upperKey =
      new Date(Math.min(endTime, cutoffTime)).toISOString().slice(0, 19) +
      '\uffff';
    while (cursor.bucket < buckets.length && data.length < limit) {
      const bucket = buckets[cursor.bucket];
      const index = kind === 'sessions' ? 'GSI1' : 'GSI3';
      const partition =
        kind === 'sessions' ? `LOG#SESSION#${bucket}` : `DATE#${bucket}`;
      const page = await this.table.queryPage({
        table:
          kind === 'sessions'
            ? this.config.sessionLogTable()
            : this.config.activityLogTable(),
        index,
        keyCondition: `${index}PK = :pk AND ${index}SK BETWEEN :start AND :end`,
        values: { ':pk': partition, ':start': lowerKey, ':end': upperKey },
        scanForward: filters.sort === 'asc',
        startKey: cursor.key,
        limit: Math.min(200, limit - data.length),
      });
      for (const item of page.items) {
        const row = reportRow(kind, item);
        const timestamp = Date.parse(row.date);
        if (
          timestamp >= startTime &&
          timestamp < endTime &&
          timestamp <= cutoffTime &&
          matchesValues(row, filters)
        )
          data.push(item);
      }
      cursor.key = page.lastKey;
      if (!page.lastKey) {
        cursor.bucket++;
        delete cursor.key;
      }
    }
    return {
      data,
      nextToken:
        cursor.bucket < buckets.length
          ? Buffer.from(JSON.stringify(cursor)).toString('base64url')
          : null,
    };
  }

  async *all(
    kind: 'sessions' | 'activity',
    filters: ReportFilters,
  ): AsyncGenerator<Item> {
    let token: string | undefined;
    do {
      const page = await this.page(kind, filters, 200, token);
      yield* page.data;
      token = page.nextToken ?? undefined;
    } while (token);
  }
}
