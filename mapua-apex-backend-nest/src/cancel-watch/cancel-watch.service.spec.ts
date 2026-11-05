import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { MemoryDynamo } from '../../test/memory-dynamo.js';
import { DynamoTable } from '../aws/dynamo-table.js';
import { DYNAMO } from '../aws/dynamo.port.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { Item } from '../common/records.js';
import { MailService } from '../mail/mail.service.js';
import { PostEvalRepository } from '../postevals/posteval.repository.js';
import { SubmissionRepository } from '../submissions/submission.repository.js';
import { CancelWatchService } from './cancel-watch.service.js';

const submission: Item = {
  PK: 'EVENT#e',
  SK: 'SUBMISSION#s',
  status: 'approved',
  activity_details: { title_and_nature: 'Fun Run', date_of_event: '2026-10-01' },
};

interface StreamLike {
  eventName?: string;
  dynamodb?: {
    SequenceNumber?: string;
    Keys?: { PK?: { S?: string }; SK?: { S?: string } };
  };
}

function removal(eventId: string, submissionId: string): StreamLike {
  return {
    eventName: 'REMOVE',
    dynamodb: {
      SequenceNumber: 'seq-1',
      Keys: {
        PK: { S: `EVENT#${eventId}` },
        SK: { S: `CANCELWATCH#${submissionId}` },
      },
    },
  };
}

async function build(env: Record<string, string> = {}) {
  const store = new MemoryDynamo();
  const mails: { kind: string; comment: string }[] = [];
  const module = await Test.createTestingModule({
    providers: [
      CancelWatchService,
      SubmissionRepository,
      PostEvalRepository,
      DynamoTable,
      AppConfigService,
      {
        provide: ConfigService,
        useValue: new ConfigService({
          AWS_DYNAMODB_TABLE: 'test',
          ARCUS_POST_EVALUATION_WINDOW_DAYS: '3',
          ...env,
        }),
      },
      { provide: DYNAMO, useValue: store },
      {
        provide: MailService,
        useValue: {
          async decision(_s: Item, kind: string, comment: string) {
            mails.push({ kind, comment });
          },
        },
      },
    ],
  }).compile();

  await store.put('test', { ...submission });
  return {
    store,
    service: module.get(CancelWatchService),
    submissions: module.get(SubmissionRepository),
    mails,
  };
}

describe('CancelWatchService', () => {
  // The first Nest testing-module compile pays a one-time cold-import cost; do
  // it in a hook so it is not counted against the per-test timeout.
  beforeAll(async () => {
    await build();
  });

  it('cancels an approved submission with no post-eval, writes a notice and email', async () => {
    const { service, submissions, mails } = await build();

    const result = await service.evaluateAndCancel('e', 's');

    expect(result).toEqual({
      status: 'cancelled',
      eventId: 'e',
      submissionId: 's',
    });
    const row = await submissions.getSubmission('e', 's');
    expect(row).toMatchObject({ status: 'cancelled' });
    expect(typeof row?.cancelled_at).toBe('string');
    const notices = await submissions.listNotifications('s');
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ notif_type: 'event auto-cancelled' });
    expect(mails).toEqual([
      expect.objectContaining({ kind: 'event auto-cancelled' }),
    ]);
  });

  it('routes a REMOVE stream record through the cancel path', async () => {
    const { service } = await build();
    const result = await service.handleRecord(removal('e', 's'));
    expect(result).toMatchObject({ status: 'cancelled' });
  });

  it('no-ops when a post-eval was filed for the event', async () => {
    const { store, service, submissions } = await build();
    await store.put('test', {
      PK: 'EVENT#e',
      SK: 'POSTEVAL#p1',
      entity_type: 'posteval',
      status: 'submitted',
    });

    const result = await service.evaluateAndCancel('e', 's');

    expect(result).toEqual({ status: 'post-eval filed' });
    expect(await submissions.getSubmission('e', 's')).toMatchObject({
      status: 'approved',
    });
  });

  it('no-ops when the submission is no longer approved', async () => {
    const { store, service, submissions, mails } = await build();
    await store.put('test', { ...submission, status: 'finished' });

    const result = await service.evaluateAndCancel('e', 's');

    expect(result).toEqual({ status: 'not-approved' });
    expect(await submissions.listNotifications('s')).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });

  it('ignores non-REMOVE events and unrelated SKs', async () => {
    const { service, submissions } = await build();
    const insert: StreamLike = {
      eventName: 'INSERT',
      dynamodb: { Keys: { PK: { S: 'EVENT#e' }, SK: { S: 'CANCELWATCH#s' } } },
    };
    expect(await service.handleRecord(insert)).toEqual({ status: 'ignored' });
    const otherSk: StreamLike = {
      eventName: 'REMOVE',
      dynamodb: { Keys: { PK: { S: 'EVENT#e' }, SK: { S: 'SUBMISSION#s' } } },
    };
    expect(await service.handleRecord(otherSk)).toEqual({ status: 'ignored' });
    expect(await submissions.getSubmission('e', 's')).toMatchObject({
      status: 'approved',
    });
  });

  it('is idempotent across a replayed REMOVE', async () => {
    const { service, submissions, mails } = await build();

    const first = await service.handleRecord(removal('e', 's'));
    const second = await service.handleRecord(removal('e', 's'));

    expect(first).toMatchObject({ status: 'cancelled' });
    expect(second).toEqual({ status: 'not-approved' });
    expect(await submissions.listNotifications('s')).toHaveLength(1);
    expect(mails).toHaveLength(1);
  });

  it('does nothing when the auto-cancel feature is disabled', async () => {
    const { service, submissions, mails } = await build({
      ARCUS_AUTO_CANCEL_ENABLED: 'false',
    });

    const result = await service.evaluateAndCancel('e', 's');

    expect(result).toEqual({ status: 'disabled' });
    expect(await submissions.getSubmission('e', 's')).toMatchObject({
      status: 'approved',
    });
    expect(await submissions.listNotifications('s')).toHaveLength(0);
    expect(mails).toHaveLength(0);
  });
});
