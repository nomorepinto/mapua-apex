import { type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Express } from 'express';
import { AppConfigService } from './config/app-config.service.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { DataEnvelopeInterceptor } from './common/data-envelope.interceptor.js';
import { createValidationPipe } from './common/validation.js';

/**
 * Shared bootstrap for the local server, the Lambda handler, and e2e tests.
 * Controllers never hard-code the version prefix.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v2', { exclude: ['up'] });
  app.enableShutdownHooks();
  const config = app.get(AppConfigService);
  app.enableCors({
    origin: config.corsOrigins(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Session-ID',
      'X-Device-ID',
      'X-Api-Key',
      'X-Organization-Id',
      'X-Signatory-Id',
      'X-Arcus-Service-Token',
      'X-Arcus-Organization-Id',
      'X-Origin-Verify',
      'ngrok-skip-browser-warning',
    ],
    credentials: true,
    maxAge: 0,
  });
  const http = app.getHttpAdapter().getInstance() as Express;
  http.set('trust proxy', true);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new DataEnvelopeInterceptor(app.get(Reflector)));
}
