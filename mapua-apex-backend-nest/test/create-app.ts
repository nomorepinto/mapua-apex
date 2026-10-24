import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Express } from 'express';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { COGNITO_IDP, DYNAMO, SES_CLIENT } from '../src/aws/dynamo.port.js';
import { JWT_VERIFIER, type JwtVerifier } from '../src/auth/jwt-verifier.js';
import { MemoryDynamo } from './memory-dynamo.js';

export const TOKENS = {
  student: {
    sub: 'student-sub',
    email: 'student@mymail.mapua.edu.ph',
    name: 'Student Example',
    'cognito:groups': ['student'],
    'custom:organization_id': 'org-1',
  },
  otherStudent: {
    sub: 'other-sub',
    email: 'other@mymail.mapua.edu.ph',
    name: 'Other Student',
    'cognito:groups': ['student'],
    'custom:organization_id': 'org-2',
  },
  signatory: {
    sub: 'signatory-sub',
    email: 'adviser@mapua.edu.ph',
    name: 'Adviser Example',
    'cognito:groups': ['signatory'],
    'custom:signatory_id': 'sig-1',
  },
  admin: {
    sub: 'admin-sub',
    email: 'admin@mapua.edu.ph',
    name: 'Admin Example',
    'cognito:groups': ['admin'],
  },
} as const;

const verifier: JwtVerifier = {
  async verify(token: string): Promise<Record<string, unknown>> {
    const claims = TOKENS[token as keyof typeof TOKENS];
    if (!claims) {
      throw new Error('unknown test token');
    }
    return claims;
  },
};

export async function createTestApp(): Promise<{
  app: INestApplication;
  dynamo: MemoryDynamo;
}> {
  process.env.AWS_DYNAMODB_TABLE ??= 'apex-test';
  process.env.APP_ENV ??= 'testing';
  process.env.NODE_ENV ??= 'test';
  process.env.GIBBERISH_CHECK_ENABLED ??= 'false';
  const dynamo = new MemoryDynamo();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DYNAMO)
    .useValue(dynamo)
    .overrideProvider(JWT_VERIFIER)
    .useValue(verifier)
    .overrideProvider(SES_CLIENT)
    .useValue({ send: async () => ({}) })
    .overrideProvider(COGNITO_IDP)
    .useValue({ send: async () => ({ Users: [] }) })
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, dynamo };
}

export function expressOf(app: INestApplication): Express {
  return app.getHttpAdapter().getInstance() as Express;
}

export function bearer(token: keyof typeof TOKENS): string {
  return `Bearer ${token}`;
}
