import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { createTestApp } from './create-app.js';

/** Opt-in integrated browser tests use the real Nest controllers and MemoryDynamo only. */
it.skipIf(process.env.REPORT_BROWSER_TEST !== '1')(
  'verifies reporting browser flows and downloads against Nest /api/v2',
  async () => {
    const { app, dynamo } = await createTestApp();
    const table = process.env.AWS_DYNAMODB_TABLE ?? 'apex-test';
    const date = new Date().toISOString();
    for (let i = 0; i < 230; i++) {
      const id = String(i).padStart(3, '0');
      await dynamo.put(table, {
        PK: `SESSION#s-${id}`,
        SK: 'METADATA',
        session_id: `s-${id}`,
        sub: `user-${i % 3}`,
        user_name: i % 2 ? 'Peña Reviewer' : 'Niño Student',
        user_role: i % 2 ? 'signatory' : 'student',
        status: 'completed',
        login_time: date,
        logout_time: new Date(Date.parse(date) + 60_000).toISOString(),
        GSI1PK: `LOG#SESSION#${date.slice(0, 7)}`,
        GSI1SK: date,
        pages_visited: [
          {
            path: '/dashboard?private=value',
            page_name: 'Dashboard',
            timestamp: date,
          },
        ],
      });
      await dynamo.put(table, {
        PK: `ACTIVITY#a-${id}`,
        SK: `ACTIVITY#a-${id}`,
        activityId: `a-${id}`,
        timestamp: date,
        GSI3PK: `DATE#${date.slice(0, 10)}`,
        GSI3SK: date,
        actionType: i % 2 ? 'SUBMISSION_APPROVE' : 'SUBMISSION_CREATE',
        module: 'SUBMISSION',
        eventId: 'e',
        entityId: `p-${id}`,
        userId: 'reviewer',
        userName: 'Peña Reviewer',
        userRole: 'signatory',
        entityName: `Forum ${id}`,
      });
    }
    await dynamo.put(table, {
      PK: 'ORGANIZATION#org-1',
      SK: 'ORGANIZATION#org-1',
      name: 'Peña Society',
      signatories: [],
    });
    for (let i = 0; i < 12; i++)
      await dynamo.put(table, {
        PK: `EVENT#e-${i}`,
        SK: `SUBMISSION#p-${i}`,
        GSI1PK: 'ORGANIZATION#org-1',
        GSI1SK: `SUBMISSION#p-${i}`,
        status: i % 2 ? 'denied' : 'approved',
        first_submitted_at: date,
        first_submitted_at_source: 'recorded',
        sent_at: date,
        activity_details: { title_and_nature: `Forum ${i}` },
        activity_classification: { activity_type: 'co-curricular' },
      });
    await dynamo.put(table, {
      PK: 'ORGANIZATION#org-2',
      SK: 'ORGANIZATION#org-2',
      name: 'Private organization',
      signatories: [],
    });
    await dynamo.put(table, {
      PK: 'SIGNATORY#sig-osaar',
      SK: 'SIGNATORY#sig-osaar',
      role: 'osaar',
      name: 'OSAAR Reviewer',
    });
    for (let i = 0; i < 3; i++)
      await dynamo.put(table, {
        PK: `EVENT#e-${i}`,
        SK: `POSTEVAL#pe-${i}`,
        GSI1PK: `ORGANIZATION#org-${i === 2 ? 2 : 1}`,
        GSI1SK: `POSTEVAL#pe-${i}`,
        submission_id: `p-${i}`,
        status: i ? 'denied' : 'submitted',
        submitted_at: date,
        event_title: `Evaluation ${i}`,
      });
    await dynamo.put(table, {
      PK: 'SUBMISSION#p-0',
      SK: `NOTIFICATION#${date}`,
      notif_type: 'fully approved',
      comment: 'Private review comment',
      signatory: 'SIGNATORY#sig-osaar',
    });
    for (let i = 1; i <= 2; i++) {
      await dynamo.put(table, {
        PK: `CAMPUS#campus-${i}`,
        SK: `CAMPUS#campus-${i}`,
        name: `Campus ${i}`,
      });
      await dynamo.put(table, {
        PK: `EVENT#e-${i - 1}`,
        SK: `RESERVATION_CHANGE#change-${i}`,
        GSI6PK: `CAMPUS#campus-${i}`,
        GSI6SK: `pending#${date}`,
        campus_id: `campus-${i}`,
        organization_id: 'org-1',
        submission_id: `p-${i - 1}`,
        request_type: i === 1 ? 'cancel' : 'reschedule',
        requested_at: date,
        status: 'pending',
        bookings: [],
      });
    }
    await app.listen(0, '127.0.0.1');
    const api = await app.getUrl();
    const root = fileURLToPath(
      new URL('../../mapua-apex-frontend/', import.meta.url),
    );
    const vite = await createServer({
      root,
      configFile: `${root}/vite.config.ts`,
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
        proxy: { '/api/v2': { target: api } },
      },
      define: {
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v2'),
        'import.meta.env.VITE_COGNITO_AUTHORITY':
          JSON.stringify('http://127.0.0.1:1'),
        'import.meta.env.VITE_COGNITO_CLIENT_ID': JSON.stringify('report-test'),
        'import.meta.env.VITE_COGNITO_DOMAIN':
          JSON.stringify('http://127.0.0.1:1'),
        'import.meta.env.VITE_API_TOKEN_ADMIN': JSON.stringify(''),
        'import.meta.env.VITE_API_TOKEN_STUDENT': JSON.stringify(''),
        'import.meta.env.VITE_API_TOKEN_SIGNATORY': JSON.stringify(''),
      },
    });
    try {
      await vite.listen();
      const base = vite.resolvedUrls?.local[0];
      expect(base).toBeTruthy();
      const result = await promisify(execFile)(
        process.execPath,
        [`${root}/scripts/report-browser.test.mjs`],
        { env: { ...process.env, REPORT_BROWSER_URL: base }, timeout: 240_000 },
      );
      console.log(result.stdout);
    } finally {
      await vite.close();
      await app.close();
    }
  },
  300_000,
);
