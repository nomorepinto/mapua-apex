import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryDynamo } from '../../test/memory-dynamo.js';
import { DynamoTable } from '../aws/dynamo-table.js';
import { DYNAMO } from '../aws/dynamo.port.js';
import { AppConfigService } from '../config/app-config.service.js';
import { SubmissionRepository } from './submission.repository.js';
import type { Item } from '../common/records.js';

const original: Item = {
  PK: 'EVENT#e',
  SK: 'SUBMISSION#s',
  status: 'returned',
  sent_at: '2024-01-02T00:00:00Z',
  current_signatory: 'SIGNATORY#a',
};
describe('immutable reporting timestamps', () => {
  let store: MemoryDynamo;
  let repository: SubmissionRepository;
  beforeEach(async () => {
    store = new MemoryDynamo();
    const module = await Test.createTestingModule({
      providers: [
        SubmissionRepository,
        DynamoTable,
        AppConfigService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ AWS_DYNAMODB_TABLE: 'test' }),
        },
        { provide: DYNAMO, useValue: store },
      ],
    }).compile();
    repository = module.get(SubmissionRepository);
    await store.put('test', { ...original });
  });
  it('preserves timestamps concurrently populated by a migration after the edit read', async () => {
    await store.update({
      table: 'test',
      key: original,
      set: {
        first_submitted_at: '2024-01-01T00:00:00Z',
        first_submitted_at_source: 'linked_creation_evidence',
        fully_approved_at: '2024-01-03T00:00:00Z',
      },
    });
    const updated = await repository.replaceEditable(original, {
      ...original,
      status: 'pending',
      sent_at: '2024-01-04T00:00:00Z',
      first_submitted_at: 'untrusted',
    });
    expect(updated).toMatchObject({
      first_submitted_at: '2024-01-01T00:00:00Z',
      first_submitted_at_source: 'linked_creation_evidence',
      fully_approved_at: '2024-01-03T00:00:00Z',
      status: 'pending',
    });
  });
  it('leaves unknown legacy dates absent on resubmission', async () => {
    const updated = await repository.replaceEditable(original, {
      ...original,
      status: 'pending',
      sent_at: '2024-01-04T00:00:00Z',
    });
    expect(updated.first_submitted_at).toBeUndefined();
    expect(updated.first_submitted_at_source).toBeUndefined();
  });
  it('rejects stale edits after the status, latest date, or desk changes', async () => {
    for (const patch of [
      { status: 'approved' },
      { sent_at: '2024-02-01T00:00:00Z' },
      { current_signatory: 'SIGNATORY#b' },
    ]) {
      await store.put('test', { ...original, ...patch });
      await expect(
        repository.replaceEditable(original, {
          ...original,
          status: 'pending',
        }),
      ).rejects.toThrow();
    }
  });
  it('keeps the assigned document number across an edit', async () => {
    await store.update({
      table: 'test',
      key: original,
      set: { document_number: 'SAAF-261113-001' },
    });
    const updated = await repository.replaceEditable(original, {
      ...original,
      status: 'pending',
      sent_at: '2024-01-04T00:00:00Z',
      document_number: 'SAAF-0000-999',
    });
    expect(updated.document_number).toBe('SAAF-261113-001');
  });
  it('assigns SAAF-YYMMDD-### from a per-day counter', async () => {
    const first = await repository.allocateDocumentNumber(
      '2026-11-13T01:00:00Z',
    );
    const second = await repository.allocateDocumentNumber(
      '2026-11-13T02:00:00Z',
    );
    const nextDay = await repository.allocateDocumentNumber(
      '2026-11-14T01:00:00Z',
    );
    expect(first).toBe('SAAF-261113-001');
    expect(second).toBe('SAAF-261113-002');
    expect(nextDay).toBe('SAAF-261114-001');
  });
  it('sets final approval only once and retains it after completion or cancellation', async () => {
    await repository.updateSubmission('e', 's', {
      status: 'approved',
      fully_approved_at: '2024-01-03T00:00:00Z',
    });
    await repository.updateSubmission('e', 's', {
      status: 'finished',
      fully_approved_at: '2024-01-09T00:00:00Z',
    });
    await repository.updateSubmission('e', 's', { status: 'cancelled' });
    expect(await repository.getSubmission('e', 's')).toMatchObject({
      fully_approved_at: '2024-01-03T00:00:00Z',
      status: 'cancelled',
    });
  });
});
