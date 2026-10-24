import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DynamoTable } from '../aws/dynamo-table.js';
import { campusKey, stripPrefix } from '../common/dynamo-keys.js';
import { num, str, type Item } from '../common/records.js';
import {
  classroomHint,
  hasFormat,
  normalizePrefixes,
} from './classroom-naming.js';

export interface CampusView {
  campus_id: string;
  name: string;
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
  ): Promise<Item> {
    const id = randomUUID();
    return this.write(id, name, prefixes, digits);
  }

  async update(
    id: string,
    name: string,
    prefixes: string[],
    digits: number | null,
  ): Promise<Item> {
    return this.write(stripPrefix(id, 'CAMPUS#') ?? id, name, prefixes, digits);
  }

  delete(id: string): Promise<void> {
    const key = campusKey(id);
    return this.table.delete(key, key);
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
  ): Promise<Item> {
    const key = campusKey(id);
    const normalized = normalizePrefixes(prefixes);
    const item: Item = { PK: key, SK: key, name };
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
    classroom_name_prefixes: formatted ? prefixes : [],
    classroom_name_digits: formatted ? digits : null,
    classroom_name_hint: formatted ? classroomHint(prefixes, digits) : null,
  };
}
