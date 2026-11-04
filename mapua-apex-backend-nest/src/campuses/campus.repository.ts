import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DynamoTable } from '../aws/dynamo-table.js';
import { campusKey, roleIndex, stripPrefix } from '../common/dynamo-keys.js';
import { bool, num, str, type Item } from '../common/records.js';
import {
  classroomHint,
  hasFormat,
  normalizePrefixes,
} from './classroom-naming.js';

export interface CampusView {
  campus_id: string;
  name: string;
  main: boolean;
  classroom_name_prefixes: string[];
  classroom_name_digits: number | null;
  classroom_name_hint: string | null;
}

@Injectable()
export class CampusRepository {
  constructor(private readonly table: DynamoTable) {}

  async list(): Promise<Item[]> {
    return this.table.scan({
      filter: 'begins_with(PK, :pk) AND PK = SK',
      values: { ':pk': 'CAMPUS#' },
      maxItems: 100,
      // Read-after-write: refetched right after a campus create/update.
      consistent: true,
    });
  }

  get(id: string): Promise<Item | undefined> {
    const key = campusKey(id);
    return this.table.get(key, key);
  }

  async create(
    name: string,
    prefixes: string[],
    digits: number | null,
    main: boolean,
  ): Promise<Item> {
    const id = randomUUID();
    return this.write(id, name, prefixes, digits, main);
  }

  async update(
    id: string,
    name: string,
    prefixes: string[],
    digits: number | null,
    main: boolean,
  ): Promise<Item> {
    return this.write(
      stripPrefix(id, 'CAMPUS#') ?? id,
      name,
      prefixes,
      digits,
      main,
    );
  }

  delete(id: string): Promise<void> {
    const key = campusKey(id);
    return this.table.delete(key, key);
  }

  /** An OSAAR account still stores this campus id. */
  async hasAssignedOsaar(id: string): Promise<boolean> {
    const bare = stripPrefix(id, 'CAMPUS#') ?? id;
    const items = await this.table.query({
      index: 'GSI4',
      keyCondition: 'GSI4PK = :role',
      values: { ':role': roleIndex('osaar') },
    });
    return items.some((item) => str(item, 'campus_id') === bare);
  }

  async hasReservables(id: string): Promise<boolean> {
    const items = await this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': campusKey(id), ':sk': 'RESERVABLE#' },
      limit: 1,
      allPages: false,
    });
    return items.length > 0;
  }

  private async write(
    id: string,
    name: string,
    prefixes: string[],
    digits: number | null,
    main: boolean,
  ): Promise<Item> {
    const key = campusKey(id);
    const normalized = normalizePrefixes(prefixes);
    const item: Item = { PK: key, SK: key, name };
    if (main) {
      item.main = true;
    }
    if (hasFormat(normalized, digits)) {
      item.classroom_name_prefixes = normalized;
      item.classroom_name_digits = digits;
    }
    await this.table.put(item);
    return item;
  }
}

export function toCampus(item: Item): CampusView {
  const prefixes = normalizePrefixes(item.classroom_name_prefixes);
  const digits = num(item, 'classroom_name_digits');
  const formatted = hasFormat(prefixes, digits);
  return {
    campus_id: stripPrefix(item.PK, 'CAMPUS#') ?? '',
    name: str(item, 'name') ?? '',
    main: bool(item, 'main'),
    classroom_name_prefixes: formatted ? prefixes : [],
    classroom_name_digits: formatted ? digits : null,
    classroom_name_hint: formatted ? classroomHint(prefixes, digits) : null,
  };
}
