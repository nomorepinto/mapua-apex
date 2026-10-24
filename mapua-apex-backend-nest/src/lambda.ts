import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import serverlessExpress from '@codegenie/serverless-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

type LambdaHandler = (event: unknown, context: unknown) => Promise<unknown>;

let cached: Promise<LambdaHandler> | undefined;

async function bootstrap(): Promise<LambdaHandler> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.init();
  return lambdaHandlerFrom(app.getHttpAdapter().getInstance() as Express);
}

/** Adapts an already-configured Express app to a Function URL payload 2.0 handler. */
export function lambdaHandlerFrom(expressApp: Express): LambdaHandler {
  return serverlessExpress({ app: expressApp });
}

/**
 * Lambda Function URL handler. The Nest app boots once per environment and
 * stays cached for warm invocations. `callbackWaitsForEmptyEventLoop` is left
 * at its default so awaited SES and log writes finish before the freeze.
 */
export async function handler(
  event: unknown,
  context: unknown,
): Promise<unknown> {
  cached ??= bootstrap();
  const handle = await cached;
  return handle(event, context);
}
