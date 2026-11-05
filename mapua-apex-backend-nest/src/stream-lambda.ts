import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { CancelWatchService } from './cancel-watch/cancel-watch.service.js';

type AppContext = Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

interface StreamRecord {
  eventName?: string;
  dynamodb?: {
    SequenceNumber?: string;
    Keys?: { PK?: { S?: string }; SK?: { S?: string } };
  };
}

interface StreamEvent {
  Records?: StreamRecord[];
}

interface BatchItemFailure {
  itemIdentifier: string;
}

let cached: Promise<AppContext> | undefined;

/** Boots the full DI graph once per environment (no HTTP) for warm reuse. */
function context(): Promise<AppContext> {
  cached ??= NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  return cached;
}

/**
 * DynamoDB Streams consumer for the auto-cancel sentinel. A TTL expiry on a
 * `CANCELWATCH#` item emits a `REMOVE` here; the service re-checks for a filed
 * post-eval and conditionally cancels. `ReportBatchItemFailures` (configured on
 * the event-source mapping) lets one poison record be retried without redriving
 * the whole batch.
 */
export async function handler(
  event: StreamEvent,
): Promise<{ batchItemFailures: BatchItemFailure[] }> {
  const app = await context();
  const service = app.get(CancelWatchService);
  const failures: BatchItemFailure[] = [];
  for (const record of event.Records ?? []) {
    try {
      await service.handleRecord(record);
    } catch (error) {
      const id = record.dynamodb?.SequenceNumber;
      if (!id) {
        // No identifier to report, so fail the batch and let Lambda redrive.
        throw error;
      }
      failures.push({ itemIdentifier: id });
    }
  }
  return { batchItemFailures: failures };
}
