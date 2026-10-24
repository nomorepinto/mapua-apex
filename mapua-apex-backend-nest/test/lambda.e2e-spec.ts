import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lambdaHandlerFrom } from '../src/lambda.js';
import { bearer, createTestApp, expressOf } from './create-app.js';

describe('Lambda Function URL payload', () => {
  let app: INestApplication;
  let handle: (event: unknown, context: unknown) => Promise<unknown>;

  beforeAll(async () => {
    process.env.ORIGIN_VERIFY_SECRET = 'edge-secret';
    const started = await createTestApp();
    app = started.app;
    handle = lambdaHandlerFrom(expressOf(app));
  });

  afterAll(async () => {
    delete process.env.ORIGIN_VERIFY_SECRET;
    await app.close();
  });

  it('reads the version prefix, bearer token, session header, query, and JSON body', async () => {
    const health = (await handle(
      event('GET', '/api/v2/ping', { 'x-origin-verify': 'edge-secret' }),
      {},
    )) as {
      statusCode: number;
      body: string;
    };
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body)).toEqual({ ok: true });

    const blocked = (await handle(event('GET', '/api/v2/ping'), {})) as {
      statusCode: number;
    };
    expect(blocked.statusCode).toBe(403);

    const email = (await handle(
      event(
        'GET',
        '/api/v2/public/validate-email',
        { 'x-origin-verify': 'edge-secret' },
        'email=person@example.com',
      ),
      {},
    )) as { statusCode: number; body: string };
    expect(email.statusCode).toBe(200);
    expect(JSON.parse(email.body).state).toBe('domain_not_allowed');

    const created = (await handle(
      event(
        'POST',
        '/api/v2/students/members',
        {
          'x-origin-verify': 'edge-secret',
          authorization: bearer('student'),
          'x-session-id': 'session-1',
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.8',
        },
        '',
        { student_number: '2026-1', lastname: 'Ramos', firstname: 'Ana' },
      ),
      {},
    )) as { statusCode: number };
    expect(created.statusCode).toBe(201);

    const removed = (await handle(
      event('DELETE', '/api/v2/students/members/2026-1', {
        'x-origin-verify': 'edge-secret',
        authorization: bearer('student'),
        'x-session-id': 'session-1',
      }),
      {},
    )) as { statusCode: number };
    expect(removed.statusCode).toBe(204);
  });
});

function event(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  rawQueryString = '',
  body?: unknown,
): Record<string, unknown> {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString,
    headers,
    queryStringParameters: Object.fromEntries(
      new URLSearchParams(rawQueryString),
    ),
    body: body ? JSON.stringify(body) : undefined,
    isBase64Encoded: false,
    requestContext: {
      accountId: '123',
      apiId: 'api',
      domainName: 'example.lambda-url.ap-southeast-1.on.aws',
      domainPrefix: 'example',
      requestId: 'req',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 0,
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
    },
  };
}
