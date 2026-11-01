import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryDynamo } from '../../test/memory-dynamo.js';
import { DynamoTable } from '../aws/dynamo-table.js';
import { DYNAMO } from '../aws/dynamo.port.js';
import { AppConfigService } from '../config/app-config.service.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { MonitorRepository } from './monitor.repository.js';
import { parseFilters } from '../common/reporting.js';
import type { Item } from '../common/records.js';

const filters = parseFilters('activity', {
  start_date: '2024-02-29',
  end_date: '2024-02-29',
});
describe('complete monitor traversal', () => {
  let store: MemoryDynamo;
  let repository: MonitorRepository;
  let table: DynamoTable;
  beforeEach(async () => {
    store = new MemoryDynamo();
    const module = await Test.createTestingModule({
      providers: [
        MonitorRepository,
        DynamoTable,
        AppConfigService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ AWS_DYNAMODB_TABLE: 'test' }),
        },
        { provide: DYNAMO, useValue: store },
      ],
    }).compile();
    repository = module.get(MonitorRepository);
    table = module.get(DynamoTable);
  });
  async function seed(
    id: string,
    timestamp: string,
    action = 'CREATE',
  ): Promise<void> {
    await store.put('test', {
      PK: `ACTIVITY#${id}`,
      SK: `ACTIVITY#${id}`,
      activityId: id,
      timestamp,
      actionType: action,
      GSI3PK: `DATE#${timestamp.slice(0, 10)}`,
      GSI3SK: timestamp,
    });
  }
  it('retrieves more than 200 records, equal timestamps, and both UTC buckets of a Manila day', async () => {
    for (let index = 0; index < 250; index++)
      await seed(String(index).padStart(3, '0'), '2024-02-28T16:00:00Z');
    await seed('later', '2024-02-29T15:59:59.999Z');
    await seed('excluded', '2024-02-29T16:00:00Z');
    const result: Item[] = [];
    for await (const row of repository.all('activity', filters))
      result.push(row);
    expect(result).toHaveLength(251);
    expect(new Set(result.map((row) => row.activityId)).size).toBe(251);
    expect(result.some((row) => row.activityId === 'excluded')).toBe(false);
  });
  it('continues through nonmatching pages and rejects cursor scope/filter mismatch', async () => {
    for (let index = 0; index < 220; index++)
      await seed(String(index), '2024-02-29T10:00:00Z', 'UPDATE');
    await seed('match', '2024-02-28T16:00:00Z');
    const selected = { ...filters, values: { action: ['CREATE'] } };
    const complete = await repository.page('activity', selected, 20);
    expect(complete.data.map((row) => row.activityId)).toEqual(['match']);
    expect(complete.nextToken).toBeNull();
    const first = await repository.page(
      'activity',
      filters,
      10,
      undefined,
      'caller',
    );
    expect(first.nextToken).toBeTruthy();
    await expect(
      repository.page(
        'activity',
        selected,
        10,
        first.nextToken ?? undefined,
        'caller',
      ),
    ).rejects.toThrow();
    await expect(
      repository.page(
        'activity',
        filters,
        10,
        first.nextToken ?? undefined,
        'other',
      ),
    ).rejects.toThrow();
  });
  it('returns an empty future range without an invalid BETWEEN query', async () => {
    expect(
      await repository.page(
        'activity',
        { start_date: '2999-01-01', end_date: '2999-01-01' },
        50,
      ),
    ).toEqual({ data: [], nextToken: null });
  });
  it('scans past empty filtered pages and more than 100 organizations', async () => {
    for (let index = 0; index < 201; index++)
      await seed(String(index), '2024-02-29T00:00:00Z');
    for (let index = 0; index < 130; index++)
      await store.put('test', {
        PK: `ORGANIZATION#${index}`,
        SK: `ORGANIZATION#${index}`,
      });
    const first = await table.scanPage({
      filter: 'begins_with(PK, :pk) AND PK = SK',
      values: { ':pk': 'ORGANIZATION#' },
      maxItems: 200,
    });
    expect(first.items).toEqual([]);
    expect(first.lastKey).toBeDefined();
    expect(await new OrganizationRepository(table).list()).toHaveLength(130);
  });
});
