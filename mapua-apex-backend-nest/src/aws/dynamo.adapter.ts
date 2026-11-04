import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import {
  Injectable,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { reportRequestOptions } from '../common/report-budget.js';
import type {
  DynamoPort,
  DynamoPage,
  QueryPageArgs,
  ScanPageArgs,
  QueryArgs,
  ScanArgs,
  TransactOp,
  UpdateArgs,
} from './dynamo.port.js';

@Injectable()
export class DynamoAdapter implements DynamoPort, OnModuleDestroy {
  private readonly client: DynamoDBClient;
  private readonly doc: DynamoDBDocumentClient;

  constructor(config: AppConfigService) {
    this.client = new DynamoDBClient(
      config.clientOptions(config.dynamoRegion(), config.dynamoEndpoint()),
    );
    this.doc = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async get(
    table: string,
    key: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    const result = await this.doc.send(
      new GetCommand({ TableName: table, Key: key }),
      reportRequestOptions(),
    );
    return result.Item;
  }

  async put(
    table: string,
    item: Record<string, unknown>,
    condition?: string,
  ): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: table,
        Item: item,
        ...(condition ? { ConditionExpression: condition } : {}),
      }),
    );
  }

  async delete(table: string, key: Record<string, unknown>): Promise<void> {
    await this.doc.send(new DeleteCommand({ TableName: table, Key: key }));
  }

  async queryPage(args: QueryPageArgs): Promise<DynamoPage> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: args.table,
        IndexName: args.index,
        KeyConditionExpression: args.keyCondition,
        FilterExpression: args.filter,
        ExpressionAttributeNames: args.names,
        ExpressionAttributeValues: args.values,
        ProjectionExpression: args.projection,
        ExclusiveStartKey: args.startKey,
        Limit: args.limit ?? 200,
        ScanIndexForward: args.scanForward,
        ConsistentRead: args.index ? undefined : args.consistent,
      }),
      reportRequestOptions(),
    );
    return { items: result.Items ?? [], lastKey: result.LastEvaluatedKey };
  }

  async scanPage(args: ScanPageArgs): Promise<DynamoPage> {
    const result = await this.doc.send(
      new ScanCommand({
        TableName: args.table,
        FilterExpression: args.filter,
        ExpressionAttributeNames: args.names,
        ExpressionAttributeValues: args.values,
        ProjectionExpression: args.projection,
        ExclusiveStartKey: args.startKey,
        Limit: args.maxItems ?? 200,
        ConsistentRead: args.consistent,
      }),
      reportRequestOptions(),
    );
    return { items: result.Items ?? [], lastKey: result.LastEvaluatedKey };
  }

  async query(args: QueryArgs): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    const allPages = args.allPages !== false;
    do {
      const result = await this.doc.send(
        new QueryCommand({
          TableName: args.table,
          IndexName: args.index,
          KeyConditionExpression: args.keyCondition,
          FilterExpression: args.filter,
          ExpressionAttributeValues: args.values,
          ExpressionAttributeNames: args.names,
          Limit: args.limit,
          ScanIndexForward: args.scanForward,
          ExclusiveStartKey: startKey,
          ConsistentRead: args.index ? undefined : args.consistent,
        }),
        reportRequestOptions(),
      );
      items.push(...(result.Items ?? []));
      startKey = result.LastEvaluatedKey;
      if (!allPages) {
        break;
      }
      if (args.limit !== undefined && items.length >= args.limit) {
        break;
      }
    } while (startKey);
    return args.limit !== undefined ? items.slice(0, args.limit) : items;
  }

  async scan(args: ScanArgs): Promise<Record<string, unknown>[]> {
    const max = args.maxItems ?? 100;
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const result = await this.doc.send(
        new ScanCommand({
          TableName: args.table,
          FilterExpression: args.filter,
          ExpressionAttributeValues: args.values,
          ExpressionAttributeNames: args.names,
          ExclusiveStartKey: startKey,
          Limit: max - items.length,
          ConsistentRead: args.consistent,
        }),
        reportRequestOptions(),
      );
      items.push(...(result.Items ?? []));
      startKey = result.LastEvaluatedKey;
    } while (startKey && items.length < max);
    return items.slice(0, max);
  }

  async update(args: UpdateArgs): Promise<Record<string, unknown>> {
    const built = buildUpdate(args.set, args.remove, args.setIfAbsent);
    const result = await this.doc.send(
      new UpdateCommand({
        TableName: args.table,
        Key: args.key,
        ...built,
        ExpressionAttributeNames: {
          ...built.ExpressionAttributeNames,
          ...args.names,
        },
        ...(built.ExpressionAttributeValues || args.values
          ? {
              ExpressionAttributeValues: {
                ...built.ExpressionAttributeValues,
                ...args.values,
              },
            }
          : {}),
        ConditionExpression: args.condition,
        ReturnValues: 'ALL_NEW',
      }),
    );
    return result.Attributes ?? {};
  }

  async transactWrite(table: string, ops: TransactOp[]): Promise<void> {
    const transactItems: NonNullable<
      TransactWriteCommandInput['TransactItems']
    > = ops.map((op) => {
      if (op.kind === 'put') {
        return {
          Put: {
            TableName: table,
            Item: op.item,
            ...(op.condition ? { ConditionExpression: op.condition } : {}),
          },
        };
      }
      if (op.kind === 'delete') {
        return {
          Delete: {
            TableName: table,
            Key: op.key,
            ...(op.condition ? { ConditionExpression: op.condition } : {}),
          },
        };
      }
      const built = buildUpdate(op.set, op.remove);
      return {
        Update: {
          TableName: table,
          Key: op.key,
          UpdateExpression: built.UpdateExpression,
          ...(built.ExpressionAttributeNames || op.names
            ? {
                ExpressionAttributeNames: {
                  ...built.ExpressionAttributeNames,
                  ...op.names,
                },
              }
            : {}),
          ...(built.ExpressionAttributeValues || op.values
            ? {
                ExpressionAttributeValues: {
                  ...built.ExpressionAttributeValues,
                  ...op.values,
                },
              }
            : {}),
          ...(op.condition ? { ConditionExpression: op.condition } : {}),
        },
      };
    });
    await this.doc.send(
      new TransactWriteCommand({ TransactItems: transactItems }),
    );
  }

  async batchPut(
    table: string,
    items: Record<string, unknown>[],
  ): Promise<void> {
    for (let index = 0; index < items.length; index += 25) {
      const chunk = items.slice(index, index + 25);
      await this.doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [table]: chunk.map((item) => ({ PutRequest: { Item: item } })),
          },
        }),
      );
    }
  }

  async batchGet(
    table: string,
    keys: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const found: Record<string, unknown>[] = [];
    const unique = [
      ...new Map(
        keys.map((key) => [`${String(key.PK)}\0${String(key.SK)}`, key]),
      ).values(),
    ];
    for (let index = 0; index < unique.length; index += 100) {
      let pending: Record<string, unknown>[] = unique.slice(index, index + 100);
      for (let attempt = 0; pending.length > 0; attempt++) {
        if (attempt >= 5)
          throw new ServiceUnavailableException({
            code: 'RETRIEVAL_INCOMPLETE',
            message: 'Batch retrieval is incomplete; retry the request.',
            retryable: true,
          });
        if (attempt > 0)
          await new Promise((resolve) =>
            setTimeout(resolve, 50 * 2 ** attempt),
          );
        const result = await this.doc.send(
          new BatchGetCommand({
            RequestItems: { [table]: { Keys: pending, ConsistentRead: true } },
          }),
          reportRequestOptions(),
        );
        found.push(...(result.Responses?.[table] ?? []));
        pending = result.UnprocessedKeys?.[table]?.Keys ?? [];
      }
    }
    return found;
  }

  onModuleDestroy(): void {
    this.doc.destroy();
    this.client.destroy();
  }
}

function buildUpdate(
  set: Record<string, unknown> | undefined,
  remove: string[] | undefined,
  setIfAbsent?: Record<string, unknown>,
): {
  UpdateExpression: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
} {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets: string[] = [];
  const entries = Object.entries(set ?? {}).filter(
    ([, value]) => value !== undefined,
  );
  entries.forEach(([key, value], index) => {
    const name = `#s${index}`;
    const placeholder = `:s${index}`;
    names[name] = key;
    values[placeholder] = value;
    sets.push(`${name} = ${placeholder}`);
  });
  Object.entries(setIfAbsent ?? {}).forEach(([key, value], index) => {
    const name = `#a${index}`;
    const placeholder = `:a${index}`;
    names[name] = key;
    values[placeholder] = value;
    sets.push(`${name} = if_not_exists(${name}, ${placeholder})`);
  });
  const removals = (remove ?? []).map((key, index) => {
    const name = `#r${index}`;
    names[name] = key;
    return name;
  });
  const parts: string[] = [];
  if (sets.length > 0) {
    parts.push(`SET ${sets.join(', ')}`);
  }
  if (removals.length > 0) {
    parts.push(`REMOVE ${removals.join(', ')}`);
  }
  if (parts.length === 0) {
    throw new Error(
      'Dynamo update needs at least one attribute to set or remove.',
    );
  }
  return {
    UpdateExpression: parts.join(' '),
    ...(Object.keys(names).length > 0
      ? { ExpressionAttributeNames: names }
      : {}),
    ...(Object.keys(values).length > 0
      ? { ExpressionAttributeValues: values }
      : {}),
  };
}
