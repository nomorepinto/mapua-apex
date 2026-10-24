import type {
  DynamoPort,
  QueryArgs,
  ScanArgs,
  TransactOp,
  UpdateArgs,
} from '../src/aws/dynamo.port.js';
import type { Item } from '../src/common/records.js';

/** In-memory DynamoDB document store for e2e. Speaks the same port the app uses. */
export class MemoryDynamo implements DynamoPort {
  private readonly tables = new Map<string, Map<string, Item>>();

  async get(
    table: string,
    key: Record<string, unknown>,
  ): Promise<Item | undefined> {
    return this.clone(this.rows(table).get(this.id(key)));
  }

  async put(
    table: string,
    item: Record<string, unknown>,
    condition?: string,
  ): Promise<void> {
    const rows = this.rows(table);
    const key = this.id(item);
    if (condition && !this.conditionHolds(rows.get(key), condition)) {
      throw conditional();
    }
    rows.set(key, this.clone(item) ?? {});
  }

  async delete(table: string, key: Record<string, unknown>): Promise<void> {
    this.rows(table).delete(this.id(key));
  }

  async query(args: QueryArgs): Promise<Item[]> {
    const matched = [...this.rows(args.table).values()].filter((item) =>
      matches(item, args.keyCondition, args.values),
    );
    if (args.scanForward === false) {
      matched.reverse();
    }
    return (
      args.limit !== undefined ? matched.slice(0, args.limit) : matched
    ).map((item) => this.clone(item) ?? {});
  }

  async scan(args: ScanArgs): Promise<Item[]> {
    const matched = [...this.rows(args.table).values()].filter((item) =>
      args.filter ? matches(item, args.filter, args.values ?? {}) : true,
    );
    const cap = args.maxItems ?? matched.length;
    return matched.slice(0, cap).map((item) => this.clone(item) ?? {});
  }

  async update(args: UpdateArgs): Promise<Item> {
    const rows = this.rows(args.table);
    const key = this.id(args.key);
    const current = rows.get(key);
    if (args.condition && !this.conditionHolds(current, args.condition)) {
      throw conditional();
    }
    const next: Item = current ? { ...current, ...args.key } : { ...args.key };
    for (const [name, value] of Object.entries(args.set ?? {})) {
      if (value !== undefined) {
        next[name] = value;
      }
    }
    for (const name of args.remove ?? []) {
      delete next[name];
    }
    rows.set(key, next);
    return this.clone(next) ?? {};
  }

  async transactWrite(table: string, ops: TransactOp[]): Promise<void> {
    for (const op of ops) {
      if (op.kind === 'put') {
        await this.put(table, op.item, op.condition);
      } else if (op.kind === 'delete') {
        await this.delete(table, op.key);
      } else {
        await this.update({ table, ...op });
      }
    }
  }

  async batchPut(
    table: string,
    items: Record<string, unknown>[],
  ): Promise<void> {
    for (const item of items) {
      await this.put(table, item);
    }
  }

  async batchGet(
    table: string,
    keys: Record<string, unknown>[],
  ): Promise<Item[]> {
    const found: Item[] = [];
    for (const key of keys) {
      const item = await this.get(table, key);
      if (item) {
        found.push(item);
      }
    }
    return found;
  }

  private rows(table: string): Map<string, Item> {
    let rows = this.tables.get(table);
    if (!rows) {
      rows = new Map();
      this.tables.set(table, rows);
    }
    return rows;
  }

  private id(key: Record<string, unknown>): string {
    return `${String(key.PK)}\0${String(key.SK)}`;
  }

  private clone(item: Item | undefined): Item | undefined {
    return item ? (structuredClone(item) as Item) : undefined;
  }

  private conditionHolds(item: Item | undefined, condition: string): boolean {
    if (condition.startsWith('attribute_not_exists(')) {
      const name = condition.slice('attribute_not_exists('.length, -1);
      return item === undefined || item[name] === undefined;
    }
    return true;
  }
}

function matches(
  item: Item,
  expression: string,
  values: Record<string, unknown>,
): boolean {
  const between = /^(\w+) = (:\w+) AND (\w+) BETWEEN (:\w+) AND (:\w+)$/.exec(
    expression,
  );
  if (between) {
    const [, leftName, leftValue, rightName, start, end] = between;
    const right = String(item[rightName ?? ''] ?? '');
    return (
      item[leftName ?? ''] === values[leftValue ?? ''] &&
      right >= String(values[start ?? '']) &&
      right <= String(values[end ?? ''])
    );
  }
  const begins = /^(\w+) = (:\w+) AND begins_with\((\w+), (:\w+)\)$/.exec(
    expression,
  );
  if (begins) {
    const [, leftName, leftValue, rightName, rightValue] = begins;
    return (
      item[leftName ?? ''] === values[leftValue ?? ''] &&
      String(item[rightName ?? ''] ?? '').startsWith(
        String(values[rightValue ?? '']),
      )
    );
  }
  const equals = /^(\w+) = (:\w+)$/.exec(expression);
  if (equals) {
    const [, name, value] = equals;
    return item[name ?? ''] === values[value ?? ''];
  }
  const scan = /^begins_with\((\w+), (:\w+)\) AND (\w+) = (\w+)$/.exec(
    expression,
  );
  if (scan) {
    const [, name, value, left, right] = scan;
    return (
      String(item[name ?? ''] ?? '').startsWith(String(values[value ?? ''])) &&
      item[left ?? ''] === item[right ?? '']
    );
  }
  return false;
}

function conditional(): Error {
  const error = new Error('The conditional request failed');
  error.name = 'ConditionalCheckFailedException';
  return error;
}
