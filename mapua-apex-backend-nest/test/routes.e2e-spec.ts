import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, expressOf } from './create-app.js';

const REQUIRED = [
  'GET /api/v2/ping',
  'GET /up',
  'GET /api/v2/public/announcements',
  'GET /api/v2/public/organizations',
  'GET /api/v2/public/validate-email',
  'POST /api/v2/public/detect-gibberish',
  'POST /api/v2/sessions/start',
  'PATCH /api/v2/sessions/:sessionId/heartbeat',
  'POST /api/v2/sessions/:sessionId/end',
  'GET /api/v2/students/submissions',
  'POST /api/v2/students/submissions',
  'GET /api/v2/students/events/:event/submissions/:submission',
  'PUT /api/v2/students/events/:event/submissions/:submission',
  'GET /api/v2/students/events/:event/submissions/:submission/notifications',
  'GET /api/v2/students/postevals/events',
  'GET /api/v2/students/postevals',
  'POST /api/v2/students/postevals',
  'GET /api/v2/students/events/:event/postevals/:posteval',
  'GET /api/v2/students/events/:event/participants',
  'GET /api/v2/students/deadlines',
  'GET /api/v2/students/announcements',
  'GET /api/v2/students/organization',
  'GET /api/v2/students/organizations',
  'GET /api/v2/students/campuses',
  'GET /api/v2/students/campuses/:campus/reservables',
  'GET /api/v2/students/campuses/:campus/reservables/:reservable/availability',
  'POST /api/v2/students/events/:event/submissions/:submission/reservation-change',
  'GET /api/v2/students/events/:event/submissions/:submission/reservation-changes',
  'GET /api/v2/students/members',
  'POST /api/v2/students/members',
  'POST /api/v2/students/members/bulk',
  'PUT /api/v2/students/members/:studentId',
  'DELETE /api/v2/students/members/:studentId',
  'GET /api/v2/signatories/me',
  'GET /api/v2/signatories/submissions',
  'GET /api/v2/signatories/submissions/history',
  'GET /api/v2/signatories/events/:event/submissions/:submission',
  'GET /api/v2/signatories/events/:event/submissions/:submission/booking-conflicts',
  'POST /api/v2/signatories/events/:event/submissions/:submission/approve',
  'POST /api/v2/signatories/events/:event/submissions/:submission/return',
  'POST /api/v2/signatories/events/:event/submissions/:submission/deny',
  'PATCH /api/v2/signatories/events/:event/submissions/:submission/classification',
  'GET /api/v2/admins/monitor/sessions',
  'GET /api/v2/admins/monitor/sessions/:id',
  'GET /api/v2/admins/monitor/activity',
  'GET /api/v2/admins/monitor/activity/:activityId',
  'GET /api/v2/admins/monitor/stats',
  'GET /api/v2/admins/submissions',
  'GET /api/v2/admins/events/:event/submissions/:submission',
  'PUT /api/v2/admins/events/:event/submissions/:submission',
  'GET /api/v2/admins/postevals',
  'GET /api/v2/admins/postevals/:event/:posteval',
  'POST /api/v2/admins/postevals/:event/:posteval/approve',
  'POST /api/v2/admins/postevals/:event/:posteval/deny',
  'GET /api/v2/admins/announcements',
  'POST /api/v2/admins/announcements',
  'PUT /api/v2/admins/announcements/:announcement',
  'DELETE /api/v2/admins/announcements/:announcement',
  'GET /api/v2/admins/organizations',
  'POST /api/v2/admins/organizations',
  'PUT /api/v2/admins/organizations/:organization',
  'DELETE /api/v2/admins/organizations/:organization',
  'GET /api/v2/admins/signatories',
  'POST /api/v2/admins/signatories',
  'PUT /api/v2/admins/signatories/:signatory',
  'DELETE /api/v2/admins/signatories/:signatory',
  'GET /api/v2/admins/campuses',
  'POST /api/v2/admins/campuses',
  'PUT /api/v2/admins/campuses/:campus',
  'DELETE /api/v2/admins/campuses/:campus',
  'GET /api/v2/admins/campuses/:campus/reservables',
  'POST /api/v2/admins/campuses/:campus/reservables',
  'PUT /api/v2/admins/campuses/:campus/reservables/:reservable',
  'DELETE /api/v2/admins/campuses/:campus/reservables/:reservable',
  'GET /api/v2/admins/campuses/:campus/reservables/:reservable/availability',
  'GET /api/v2/admins/campuses/:campus/reservables/:reservable/bookings',
  'POST /api/v2/admins/campuses/:campus/reservables/:reservable/bookings',
  'DELETE /api/v2/admins/campuses/:campus/reservables/:reservable/bookings/:booking',
  'GET /api/v2/admins/campuses/:campus/reservation-changes',
  'GET /api/v2/admins/campuses/:campus/reservation-changes/:change',
  'POST /api/v2/admins/campuses/:campus/reservation-changes/:change/resolve',
  'GET /api/v2/arcus/events',
  'GET /api/v2/arcus/students/:studentId/events',
  'GET /api/v2/arcus/events/:eventId/post-eval',
];

const DROPPED = [
  'GET /api/v2/sessions/:sessionId/validate',
  'POST /api/v2/admins/monitor/sessions/:id/revoke',
  'GET /api/v2/admins/monitor/bottlenecks',
  'GET /api/v2/admins/announcements/:announcement',
  'POST /api/v2/students/events/:event/submissions/:submission/notifications',
  'POST /api/v2/signatories/events/:event/submissions/:submission/notifications',
];

describe('route inventory', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers every in-scope route and leaves the dropped routes out', () => {
    const registered = new Set(collect(expressOf(app)));
    const missing = REQUIRED.filter((route) => !registered.has(route));
    const present = DROPPED.filter((route) => registered.has(route));
    expect(missing).toEqual([]);
    expect(present).toEqual([]);
  });
});

function collect(app: {
  _router?: { stack: Layer[] };
  router?: { stack: Layer[] };
}): string[] {
  const found: string[] = [];
  walk(app.router?.stack ?? app._router?.stack ?? [], '', found);
  return found;
}

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
  path?: string;
}

function walk(layers: Layer[], prefix: string, found: string[]): void {
  for (const layer of layers) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        found.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
      }
    } else if (layer.handle?.stack) {
      walk(layer.handle.stack, prefix + (layer.path ?? ''), found);
    }
  }
}
