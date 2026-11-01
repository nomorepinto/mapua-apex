import type {
  DynamoPort,
  DynamoPage,
  QueryPageArgs,
  ScanPageArgs,
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

  async queryPage(args: QueryPageArgs): Promise<DynamoPage> {
    const sortKey = args.index ? `${args.index}SK` : 'SK';
    const candidates = [...this.rows(args.table).values()]
      .filter((item) => matches(item, args.keyCondition, args.values))
      .sort(
        (a, b) =>
          String(a[sortKey]).localeCompare(String(b[sortKey])) ||
          this.id(a).localeCompare(this.id(b)),
      );
    if (args.scanForward === false) candidates.reverse();
    return this.paginate(
      candidates,
      args.startKey,
      args.limit ?? 200,
      args.filter,
      args.values,
      args.index,
    );
  }

  async scanPage(args: ScanPageArgs): Promise<DynamoPage> {
    return this.paginate(
      [...this.rows(args.table).values()],
      args.startKey,
      args.maxItems ?? 200,
      args.filter,
      args.values ?? {},
    );
  }

  private paginate(
    candidates: Item[],
    startKey: Item | undefined,
    limit: number,
    filter: string | undefined,
    values: Item,
    index?: string,
  ): DynamoPage {
    const start = startKey
      ? candidates.findIndex((row) => this.id(row) === this.id(startKey)) + 1
      : 0;
    const evaluated = candidates.slice(start, start + limit);
    const last = evaluated.at(-1);
    const lastKey =
      last && start + limit < candidates.length
        ? {
            PK: last.PK,
            SK: last.SK,
            ...(index
              ? {
                  [`${index}PK`]: last[`${index}PK`],
                  [`${index}SK`]: last[`${index}SK`],
                }
              : {}),
          }
        : undefined;
    return {
      items: evaluated
        .filter((row) => !filter || matches(row, filter, values))
        .map((row) => this.clone(row) ?? {}),
      lastKey,
    };
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
    if (
      args.condition &&
      !this.conditionHolds(current, args.condition, args.names, args.values)
    ) {
      throw conditional();
    }
    const next: Item = current ? { ...current, ...args.key } : { ...args.key };
    for (const [name, value] of Object.entries(args.set ?? {})) {
      if (value !== undefined) {
        next[name] = value;
      }
    }
    for (const [name, value] of Object.entries(args.setIfAbsent ?? {})) {
      if (next[name] === undefined) next[name] = value;
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
    for (const key of new Map(
      keys.map((key) => [this.id(key), key]),
    ).values()) {
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

  private conditionHolds(
    item: Item | undefined,
    condition: string,
    names: Record<string, string> = {},
    values: Item = {},
  ): boolean {
    const resolved = condition.replace(/#\w+/g, (key) => names[key] ?? key);
    return resolved.split(' AND ').every((part) => {
      const absent = /^attribute_not_exists\((\w+)\)$/.exec(part);
      if (absent) return item?.[absent[1]!] === undefined;
      const present = /^attribute_exists\((\w+)\)$/.exec(part);
      if (present) return item?.[present[1]!] !== undefined;
      const equal = /^(\w+) = (:\w+)$/.exec(part);
      if (equal) return item?.[equal[1]!] === values[equal[2]!];
      return true;
    });
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
