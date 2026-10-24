export interface QueryArgs {
  table: string;
  index?: string;
  keyCondition: string;
  filter?: string;
  values: Record<string, unknown>;
  names?: Record<string, string>;
  limit?: number;
  scanForward?: boolean;
  allPages?: boolean;
  consistent?: boolean;
}

export interface ScanArgs {
  table: string;
  filter?: string;
  values?: Record<string, unknown>;
  names?: Record<string, string>;
  maxItems?: number;
}

export interface UpdateArgs {
  table: string;
  key: Record<string, unknown>;
  set?: Record<string, unknown>;
  remove?: string[];
  condition?: string;
}

export type TransactOp =
  | {
      kind: 'put';
      item: Record<string, unknown>;
      condition?: string;
    }
  | {
      kind: 'update';
      key: Record<string, unknown>;
      set?: Record<string, unknown>;
      remove?: string[];
      condition?: string;
      values?: Record<string, unknown>;
      names?: Record<string, string>;
    }
  | {
      kind: 'delete';
      key: Record<string, unknown>;
      condition?: string;
    };

/** Document-level Dynamo access. Tests replace this with an in-memory fake. */
export interface DynamoPort {
  get(
    table: string,
    key: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined>;
  put(
    table: string,
    item: Record<string, unknown>,
    condition?: string,
  ): Promise<void>;
  delete(table: string, key: Record<string, unknown>): Promise<void>;
  query(args: QueryArgs): Promise<Record<string, unknown>[]>;
  scan(args: ScanArgs): Promise<Record<string, unknown>[]>;
  update(args: UpdateArgs): Promise<Record<string, unknown>>;
  transactWrite(table: string, ops: TransactOp[]): Promise<void>;
  batchPut(table: string, items: Record<string, unknown>[]): Promise<void>;
  batchGet(
    table: string,
    keys: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]>;
}

export const DYNAMO = Symbol('DYNAMO');
export const SES_CLIENT = Symbol('SES_CLIENT');
export const COGNITO_IDP = Symbol('COGNITO_IDP');
