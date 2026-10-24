import { Inject, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import {
  DYNAMO,
  type DynamoPort,
  type QueryArgs,
  type ScanArgs,
  type TransactOp,
  type UpdateArgs,
} from './dynamo.port.js';

/** Main-table helpers. Log tables pass an explicit table name. */
@Injectable()
export class DynamoTable {
  constructor(
    @Inject(DYNAMO) private readonly dynamo: DynamoPort,
    private readonly config: AppConfigService,
  ) {}

  main(): string {
    return this.config.dynamoTable();
  }

  get(
    pk: string,
    sk: string,
    table = this.main(),
  ): Promise<Record<string, unknown> | undefined> {
    return this.dynamo.get(table, { PK: pk, SK: sk });
  }

  put(
    item: Record<string, unknown>,
    condition?: string,
    table = this.main(),
  ): Promise<void> {
    return this.dynamo.put(table, item, condition);
  }

  delete(pk: string, sk: string, table = this.main()): Promise<void> {
    return this.dynamo.delete(table, { PK: pk, SK: sk });
  }

  query(
    args: Omit<QueryArgs, 'table'> & { table?: string },
  ): Promise<Record<string, unknown>[]> {
    return this.dynamo.query({ table: args.table ?? this.main(), ...args });
  }

  scan(
    args: Omit<ScanArgs, 'table'> & { table?: string } = {},
  ): Promise<Record<string, unknown>[]> {
    return this.dynamo.scan({ table: args.table ?? this.main(), ...args });
  }

  update(
    args: Omit<UpdateArgs, 'table'> & { table?: string },
  ): Promise<Record<string, unknown>> {
    return this.dynamo.update({ table: args.table ?? this.main(), ...args });
  }

  transact(ops: TransactOp[], table = this.main()): Promise<void> {
    return this.dynamo.transactWrite(table, ops);
  }

  batchPut(
    items: Record<string, unknown>[],
    table = this.main(),
  ): Promise<void> {
    return this.dynamo.batchPut(table, items);
  }

  batchGet(
    keys: { PK: string; SK: string }[],
    table = this.main(),
  ): Promise<Record<string, unknown>[]> {
    return this.dynamo.batchGet(table, keys);
  }
}
