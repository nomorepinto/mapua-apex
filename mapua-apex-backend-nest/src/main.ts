import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

/**
 * Lambda Web Functions set `AWS_LAMBDA_HTTP_ENDPOINT` to `host:port` and route
 * requests only to that address. Local runs leave it unset and use `PORT`.
 */
function listenTarget(): { port: number; host?: string } {
  const endpoint = process.env.AWS_LAMBDA_HTTP_ENDPOINT;
  if (!endpoint) {
    return { port: Number(process.env.PORT ?? 3000) };
  }
  const separator = endpoint.lastIndexOf(':');
  const host = endpoint.slice(0, separator);
  const port = Number(endpoint.slice(separator + 1));
  if (
    separator <= 0 ||
    host.length === 0 ||
    !Number.isInteger(port) ||
    port <= 0
  ) {
    throw new Error(
      `AWS_LAMBDA_HTTP_ENDPOINT must be host:port, received ${endpoint}`,
    );
  }
  return { port, host };
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const target = listenTarget();
  if (target.host) {
    await app.listen(target.port, target.host);
    return;
  }
  await app.listen(target.port);
}

await bootstrap();
