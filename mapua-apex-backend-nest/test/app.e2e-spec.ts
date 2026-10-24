import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestApp } from './create-app.js';

describe('API contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const started = await createTestApp();
    app = started.app;
    await started.dynamo.put(process.env.AWS_DYNAMODB_TABLE ?? 'apex-test', {
      PK: 'ORGANIZATION#org-1',
      SK: 'ORGANIZATION#org-1',
      name: 'Society',
      is_higher_council: false,
      signatories: [],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves health checks without a bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/ping')
      .expect(200)
      .expect({ ok: true });
    await request(app.getHttpServer())
      .get('/up')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('rejects a missing bearer token and a wrong group', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/students/organization')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v2/students/organization')
      .set('Authorization', bearer('signatory'))
      .expect(401);
  });

  it('returns the caller organization and hides another org', async () => {
    const own = await request(app.getHttpServer())
      .get('/api/v2/students/organization')
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(own.body.data.organization_id).toBe('org-1');
    await request(app.getHttpServer())
      .get('/api/v2/students/organization')
      .set('Authorization', bearer('otherStudent'))
      .expect(404)
      .expect({ message: 'Organization not found.' });
  });

  it('returns a Laravel validation bag for a bad write', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/admins/organizations')
      .set('Authorization', bearer('admin'))
      .send({})
      .expect(422);
    expect(response.body.message).toContain('name');
    expect(response.body.errors.name).toBeInstanceOf(Array);
  });

  it('answers the public email check without an envelope', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/public/validate-email')
      .query({ email: 'person@example.com' })
      .expect(200)
      .expect({ state: 'domain_not_allowed', cached: false });
  });

  it('creates and deletes a member, including the unwrapped bulk response', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/students/members')
      .set('Authorization', bearer('student'))
      .send({
        student_number: '2021-00123',
        lastname: 'Cruz',
        firstname: 'Juan',
      })
      .expect(201);
    const bulk = await request(app.getHttpServer())
      .post('/api/v2/students/members/bulk')
      .set('Authorization', bearer('student'))
      .send({
        members: [
          { student_number: '2021-00123', lastname: 'Cruz', firstname: 'Juan' },
          {
            student_number: '2021-00456',
            lastname: 'Santos',
            firstname: 'Nicole',
          },
        ],
      })
      .expect(201);
    expect(bulk.body.data).toBeUndefined();
    expect(bulk.body.failed[0].student_number).toBe('2021-00123');
    await request(app.getHttpServer())
      .delete('/api/v2/students/members/2021-00456')
      .set('Authorization', bearer('student'))
      .expect(204);
  });
});
