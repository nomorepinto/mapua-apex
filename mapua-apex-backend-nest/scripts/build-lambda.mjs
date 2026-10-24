import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['src/lambda.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/lambda.js',
  sourcemap: true,
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  external: [
    '@nestjs/microservices',
    '@nestjs/websockets',
    'class-transformer/storage',
    '@grpc/grpc-js',
    'kafkajs',
    'mqtt',
    'nats',
    'amqplib',
    'amqp-connection-manager',
  ],
});
