import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

const web = process.argv[2] === 'web';

await mkdir('dist', { recursive: true });

await build({
  entryPoints: [web ? 'src/main.ts' : 'src/lambda.ts'],
  bundle: true,
  platform: 'node',
  target: web ? 'node24' : 'node22',
  format: 'esm',
  outfile: web ? 'dist/index.js' : 'dist/lambda.js',
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
