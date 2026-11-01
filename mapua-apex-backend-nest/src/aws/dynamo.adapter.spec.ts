import { ConfigService } from '@nestjs/config';
import {
  DynamoDBDocumentClient,
  type BatchGetCommand,
  type UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service.js';
import { DynamoAdapter } from './dynamo.adapter.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function adapter(send: ReturnType<typeof vi.fn>): DynamoAdapter {
  vi.spyOn(DynamoDBDocumentClient, 'from').mockReturnValue({
    send,
    destroy: vi.fn(),
  } as unknown as DynamoDBDocumentClient);
  return new DynamoAdapter(
    new AppConfigService(new ConfigService({ AWS_REGION: 'ap-southeast-1' })),
  );
}
describe('complete Dynamo batch retrieval and atomic attributes', () => {
  it('deduplicates keys, batches at 100 and retries only unprocessed keys', async () => {
    const keys = Array.from({ length: 101 }, (_, i) => ({
      PK: `P${i}`,
      SK: 'S',
    }));
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Responses: { test: keys.slice(0, 99) },
        UnprocessedKeys: { test: { Keys: [keys[99]] } },
      })
      .mockResolvedValueOnce({ Responses: { test: [keys[99]] } })
      .mockResolvedValueOnce({ Responses: { test: [keys[100]] } });
    const result = await adapter(send).batchGet('test', [...keys, keys[0]!]);
    expect(result).toHaveLength(101);
    const commands = send.mock.calls.map(
      ([command]) => command as BatchGetCommand,
    );
    expect(
      commands.map((command) => command.input.RequestItems?.test?.Keys?.length),
    ).toEqual([100, 1, 1]);
    expect(commands[1]?.input.RequestItems?.test?.Keys).toEqual([keys[99]]);
    expect(
      commands.every(
        (command) => command.input.RequestItems?.test?.ConsistentRead,
      ),
    ).toBe(true);
  });
  it('returns a retryable 503 instead of partial data after bounded retries', async () => {
    vi.useFakeTimers();
    const keys = [{ PK: 'P', SK: 'S' }];
    const send = vi.fn().mockResolvedValue({
      Responses: { test: [] },
      UnprocessedKeys: { test: { Keys: keys } },
    });
    const checked = expect(
      adapter(send).batchGet('test', keys),
    ).rejects.toMatchObject({
      status: 503,
      response: { code: 'RETRIEVAL_INCOMPLETE', retryable: true },
    });
    await vi.runAllTimersAsync();
    await checked;
    expect(send).toHaveBeenCalledTimes(5);
  });
  it('emits if_not_exists and retains optimistic condition placeholders', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Attributes: { status: 'approved' } });
    await adapter(send).update({
      table: 'test',
      key: { PK: 'P', SK: 'S' },
      set: { status: 'approved' },
      setIfAbsent: { fully_approved_at: '2024-01-01T00:00:00Z' },
      condition: '#old = :old',
      names: { '#old': 'status' },
      values: { ':old': 'pending' },
    });
    const command = send.mock.calls[0]?.[0] as UpdateCommand;
    expect(command.input.UpdateExpression).toContain('if_not_exists(#a0, :a0)');
    expect(command.input.ExpressionAttributeNames).toMatchObject({
      '#a0': 'fully_approved_at',
      '#old': 'status',
    });
    expect(command.input.ExpressionAttributeValues).toMatchObject({
      ':old': 'pending',
    });
    expect(command.input.ConditionExpression).toBe('#old = :old');
  });
});
