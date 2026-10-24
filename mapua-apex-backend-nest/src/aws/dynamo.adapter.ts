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
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import type {
  DynamoPort,
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
        }),
      );
      items.push(...(result.Items ?? []));
      startKey = result.LastEvaluatedKey;
    } while (startKey && items.length < max);
    return items.slice(0, max);
  }

  async update(args: UpdateArgs): Promise<Record<string, unknown>> {
    const built = buildUpdate(args.set, args.remove);
    const result = await this.doc.send(
      new UpdateCommand({
        TableName: args.table,
        Key: args.key,
        ...built,
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
    for (let index = 0; index < keys.length; index += 100) {
      const chunk = keys.slice(index, index + 100);
      const result = await this.doc.send(
        new BatchGetCommand({
          RequestItems: { [table]: { Keys: chunk, ConsistentRead: true } },
        }),
      );
      found.push(...(result.Responses?.[table] ?? []));
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
