import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, createTestApp, TOKENS } from './create-app.js';
import { activeSessionSk, userKey } from '../src/common/dynamo-keys.js';
import type { MemoryDynamo } from './memory-dynamo.js';
import { SubmissionQueryService } from '../src/submissions/submission-query.service.js';
import { reportTimeout, reportTooLarge } from '../src/common/report-budget.js';

const filters = { start_date: '2024-02-29', end_date: '2024-02-29' };
// Report routes that survive the OSAAR/super-admin lockdown. The scoped
// student/signatory report endpoints were removed, and the reservation-changes
// report is now `report_admin`, so CDM reviewers can no longer export it.
const routes: [string, keyof typeof TOKENS][] = [
  ['admins/monitor/sessions', 'admin'],
  ['admins/monitor/activity', 'osaar'],
  ['admins/submissions', 'admin'],
  ['admins/postevals', 'osaar'],
  ['admins/campuses/campus-1/reservation-changes', 'admin'],
];
describe('authorized report contracts', () => {
  let app: INestApplication;
  let store: MemoryDynamo;
  let table: string;
  beforeAll(async () => {
    const started = await createTestApp();
    app = started.app;
    store = started.dynamo;
    table = process.env.AWS_DYNAMODB_TABLE ?? 'apex-test';
    for (const id of ['org-1', 'org-2']) {
      await store.put(table, {
        PK: `ORGANIZATION#${id}`,
        SK: `ORGANIZATION#${id}`,
        name: id === 'org-1' ? 'Peña Society' : 'Private organization',
        signatories: [],
      });
      await store.put(table, {
        PK: `EVENT#${id}`,
        SK: `SUBMISSION#${id}`,
        GSI1PK: `ORGANIZATION#${id}`,
        GSI1SK: `SUBMISSION#${id}`,
        status: 'approved',
        first_submitted_at: '2024-02-29T00:00:00Z',
        first_submitted_at_source: 'recorded',
        activity_details: { title_and_nature: `${id} proposal` },
        signatory_sequence: id === 'org-1' ? ['sig-1'] : [],
      });
    }
    await store.put(table, {
      PK: 'SIGNATORY#sig-1',
      SK: 'SIGNATORY#sig-1',
      role: 'adviser',
    });
  });
  afterAll(async () => {
    await app.close();
  });
  for (const [path, token] of routes) {
    it(`returns a no-store public report with HTTP 200: ${path}`, async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v2/${path}/report`)
        .set('Authorization', bearer(token))
        .send({ filters })
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(response.body.data.coverage.retrieval_complete).toBe(true);
      expect(response.body.data.rows).toBeInstanceOf(Array);
      expect(JSON.stringify(response.body)).not.toContain('GSI1PK');
      expect(JSON.stringify(response.body)).not.toContain('"PK"');
    });
    it(`rejects missing authentication and unsafe columns: ${path}`, async () => {
      await request(app.getHttpServer())
        .post(`/api/v2/${path}/report`)
        .send({ filters })
        .expect(401);
      const invalid = await request(app.getHttpServer())
        .post(`/api/v2/${path}/report`)
        .set('Authorization', bearer(token))
        .send({ filters, columns: ['PK'] })
        .expect(422);
      expect(invalid.body.code).toBe('INVALID_REPORT_FILTER');
    });
  }
  it('keeps sessions super-admin-only and narrows activity reports to report admins', async () => {
    for (const token of [
      'osaar',
      'cdm',
      'student',
      'signatory',
      'missingRole',
    ] as const) {
      await request(app.getHttpServer())
        .post('/api/v2/admins/monitor/sessions/report')
        .set('Authorization', bearer(token))
        .send({ filters })
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v2/admins/monitor/sessions')
        .set('Authorization', bearer(token))
        .expect(401);
      await request(app.getHttpServer())
        .get('/api/v2/admins/monitor/sessions/any')
        .set('Authorization', bearer(token))
        .expect(401);
    }
    // Activity reports are now `report_admin` (admin + osaar + super_admin), so
    // CDM reviewers lose export access while OSAAR keeps it.
    await request(app.getHttpServer())
      .post('/api/v2/admins/monitor/activity/report')
      .set('Authorization', bearer('cdm'))
      .send({ filters })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v2/admins/monitor/activity/report')
      .set('Authorization', bearer('osaar'))
      .send({ filters })
      .expect(200);
  });
  it('rejects callers outside the report_admin group on surviving report routes', async () => {
    for (const [path, token] of [
      ['admins/submissions', 'student'],
      ['admins/submissions', 'signatory'],
      ['admins/submissions', 'cdm'],
      ['admins/postevals', 'cdm'],
      ['admins/monitor/activity', 'cdm'],
      ['admins/campuses/campus-1/reservation-changes', 'cdm'],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/v2/${path}/report`)
        .set('Authorization', bearer(token))
        .send({ filters })
        .expect(401);
    }
  });
  it('removes scoped report endpoints and keeps student data organization-scoped', async () => {
    await store.put(table, {
      PK: 'EVENT#unknown',
      SK: 'SUBMISSION#unknown',
      GSI1PK: 'ORGANIZATION#org-2',
      GSI1SK: 'SUBMISSION#unknown',
      status: 'pending',
    });
    // The scoped student/signatory report endpoints were deleted for the
    // OSAAR/super-admin lockdown, so they must not resolve for any caller.
    for (const [path, token] of [
      ['students/submissions', 'student'],
      ['students/postevals', 'student'],
      ['signatories/submissions/history', 'signatory'],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/v2/${path}/report`)
        .set('Authorization', bearer(token))
        .send({ filters })
        .expect(404);
    }
    // The student submission list stays organization-scoped: org-1 never sees
    // org-2 rows.
    const own = await request(app.getHttpServer())
      .get('/api/v2/students/submissions')
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(own.body.data).toHaveLength(1);
    expect(JSON.stringify(own.body)).not.toContain('org-2');
    // Cross-organization notifications remain forbidden.
    await request(app.getHttpServer())
      .get('/api/v2/students/events/org-2/submissions/org-2/notifications')
      .set('Authorization', bearer('student'))
      .expect(404);
  });
  it('requires active sessions on every report route outside test bypass', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', 'production');
    try {
      for (const [path, token] of routes) {
        const response = await request(app.getHttpServer())
          .post(`/api/v2/${path}/report`)
          .set('Authorization', bearer(token))
          .send({ filters })
          .expect(428);
        expect(response.body.code).toBe('SESSION_REQUIRED');
        expect(response.body.data).toBeUndefined();
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('rejects displaced, revoked, and stale sessions before report retrieval', async () => {
    // Mirror AppConfigService.sessionLogTable(): an empty/blank env value means
    // "use the main table", so fall back rather than writing to a "" table.
    const sessionTable =
      process.env.AWS_DYNAMODB_SESSION_LOG_TABLE?.trim() || table;
    for (const [path, token] of routes) {
      const key = { PK: userKey(TOKENS[token].sub), SK: activeSessionSk() };
      await store.put(sessionTable, {
        ...key,
        session_id: 'current-report-session',
        last_heartbeat: new Date().toISOString(),
      });
      for (const [reason, code] of [
        ['concurrent_login', 'CONCURRENT_LOGIN_DISPLACED'],
        ['admin_revoked', 'SESSION_REVOKED'],
        ['logout', 'SESSION_EXPIRED'],
      ]) {
        await store.put(sessionTable, {
          PK: 'SESSION#old-report-session',
          SK: 'METADATA',
          end_reason: reason,
        });
        const response = await request(app.getHttpServer())
          .post(`/api/v2/${path}/report`)
          .set('Authorization', bearer(token))
          .set('X-Session-ID', 'old-report-session')
          .send({ filters })
          .expect(409);
        expect(response.body.code).toBe(code);
        expect(response.body.data).toBeUndefined();
      }
      await store.put(sessionTable, {
        ...key,
        session_id: 'current-report-session',
        last_heartbeat: new Date(Date.now() - 16 * 60_000).toISOString(),
      });
      const stale = await request(app.getHttpServer())
        .post(`/api/v2/${path}/report`)
        .set('Authorization', bearer(token))
        .set('X-Session-ID', 'current-report-session')
        .send({ filters })
        .expect(409);
      expect(stale.body.code).toBe('SESSION_EXPIRED');
      await store.put(sessionTable, {
        ...key,
        session_id: 'current-report-session',
        last_heartbeat: new Date().toISOString(),
      });
      await request(app.getHttpServer())
        .post(`/api/v2/${path}/report`)
        .set('Authorization', bearer(token))
        .set('X-Session-ID', 'current-report-session')
        .send({ filters })
        .expect(200);
    }
  });
  it('includes an authorized collaboration only once and rejects missing linked data', async () => {
    const row = (await store.get(table, {
      PK: 'EVENT#org-2',
      SK: 'SUBMISSION#org-2',
    }))!;
    await store.put(table, {
      ...row,
      collaboration: { dependent_organization_ids: ['org-1'] },
    });
    await store.put(table, {
      PK: 'ORGANIZATION#org-1',
      SK: 'COLLAB#org-2#org-2',
      event_id: 'org-2',
      submission_id: 'org-2',
    });
    // The scoped report endpoint is gone, but the student submission list uses
    // the same organization + collaboration iterator.
    const response = await request(app.getHttpServer())
      .get('/api/v2/students/submissions')
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(response.body.data).toHaveLength(2);
    await store.put(table, {
      PK: 'ORGANIZATION#org-1',
      SK: 'COLLAB#missing',
      event_id: 'missing',
      submission_id: 'missing',
    });
    const failure = await request(app.getHttpServer())
      .get('/api/v2/students/submissions')
      .set('Authorization', bearer('student'))
      .expect(503);
    expect(failure.body.data).toBeUndefined();
    expect(failure.body.code).toBe('RETRIEVAL_INCOMPLETE');
  });
  it('preserves structured limit and timeout errors through the HTTP exception filter', async () => {
    const report = vi.spyOn(app.get(SubmissionQueryService), 'report');
    try {
      report.mockRejectedValueOnce(reportTimeout());
      const timeout = await request(app.getHttpServer())
        .post('/api/v2/admins/submissions/report')
        .set('Authorization', bearer('admin'))
        .send({ filters })
        .expect(503);
      expect(timeout.body).toMatchObject({
        code: 'REPORT_TIMEOUT',
        retryable: true,
      });
      expect(timeout.body.message).toContain('Narrow');
      expect(timeout.body.data).toBeUndefined();
      report.mockImplementationOnce(async () => reportTooLarge());
      const limit = await request(app.getHttpServer())
        .post('/api/v2/admins/submissions/report')
        .set('Authorization', bearer('admin'))
        .send({ filters })
        .expect(422);
      expect(limit.body.code).toBe('REPORT_TOO_LARGE');
      expect(limit.body.message).toContain('summary only');
      expect(limit.body.data).toBeUndefined();
    } finally {
      report.mockRestore();
    }
  });
});
