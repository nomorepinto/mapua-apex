import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

// Target switch: `web` (HTTP Function URL entry, node24), `stream` (DynamoDB
// Streams consumer entry, node22), or the default non-web lambda handler.
const target = process.argv[2];
const config =
  target === 'web'
    ? { entry: 'src/main.ts', outfile: 'dist/index.js', node: 'node24' }
    : target === 'stream'
      ? {
          entry: 'src/stream-lambda.ts',
          outfile: 'dist/stream-lambda.js',
          node: 'node22',
        }
      : { entry: 'src/lambda.ts', outfile: 'dist/lambda.js', node: 'node22' };

await mkdir('dist', { recursive: true });

await build({
  entryPoints: [config.entry],
  bundle: true,
  platform: 'node',
  target: config.node,
  format: 'esm',
  outfile: config.outfile,
  sourcemap: true,
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
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
