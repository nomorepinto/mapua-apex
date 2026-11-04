import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DynamoTable } from '../aws/dynamo-table.js';
import { organizationKey, stripPrefix } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';

const DESK_ORDER = ['adviser', 'dean', 'osaar', 'cdm', 'admin'];

export interface Desk {
  role: string;
  signatory_id: string;
}

@Injectable()
export class OrganizationRepository {
  constructor(private readonly table: DynamoTable) {}

  async list(): Promise<Item[]> {
    const items: Item[] = [];
    let startKey: Item | undefined;
    do {
      const page = await this.table.scanPage({
        filter: 'begins_with(PK, :pk) AND PK = SK',
        values: { ':pk': 'ORGANIZATION#' },
        maxItems: 200,
        startKey,
        // Read-after-write: the admin UI refetches this list right after an
        // organization create, so a strongly-consistent scan keeps the new row.
        consistent: true,
      });
      items.push(...page.items);
      startKey = page.lastKey;
    } while (startKey);
    return items;
  }

  get(id: string): Promise<Item | undefined> {
    const key = organizationKey(id);
    return this.table.get(key, key);
  }

  async create(
    name: string,
    desks: Desk[],
    skipDean: boolean,
    skipPostEval: boolean,
  ): Promise<Item> {
    const id = randomUUID();
    const key = organizationKey(id);
    const item: Item = {
      PK: key,
      SK: key,
      name,
      skip_dean: skipDean,
      skip_post_eval: skipPostEval,
      signatories: orderDesks(desks),
    };
    await this.table.put(item);
    return item;
  }

  update(
    id: string,
    name: string,
    desks: Desk[],
    skipDean: boolean,
    skipPostEval: boolean,
  ): Promise<Item> {
    const key = organizationKey(id);
    return this.table.update({
      key: { PK: key, SK: key },
      set: {
        name,
        skip_dean: skipDean,
        skip_post_eval: skipPostEval,
        signatories: orderDesks(desks),
      },
    });
  }

  delete(id: string): Promise<void> {
    const key = organizationKey(id);
    return this.table.delete(key, key);
  }

  async hasEvents(id: string): Promise<boolean> {
    const items = await this.table.query({
      index: 'GSI1',
      keyCondition: 'GSI1PK = :pk',
      values: { ':pk': organizationKey(id) },
      limit: 1,
      allPages: false,
    });
    return items.length > 0;
  }

  async hasPrefix(id: string, prefix: string): Promise<boolean> {
    const items = await this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': organizationKey(id), ':sk': prefix },
      limit: 1,
      allPages: false,
    });
    return items.length > 0;
  }
}

export function orderDesks(desks: Desk[]): Desk[] {
  return [...desks]
    .map((desk) => ({
      role: desk.role.toLowerCase(),
      signatory_id:
        stripPrefix(desk.signatory_id, 'SIGNATORY#') ?? desk.signatory_id,
    }))
    .sort((left, right) => {
      const rank = (role: string): number => {
        const index = DESK_ORDER.indexOf(role);
        return index === -1 ? 99 : index;
      };
      const byRole = rank(left.role) - rank(right.role);
      return byRole !== 0
        ? byRole
        : left.signatory_id.localeCompare(right.signatory_id);
    });
}

export function desksOf(item: Item): Desk[] {
  const raw = item.signatories;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }
    const role = (entry as Item).role;
    const id = (entry as Item).signatory_id;
    if (typeof role !== 'string' || typeof id !== 'string' || id === '') {
      return [];
    }
    return [
      {
        role: role.toLowerCase(),
        signatory_id: stripPrefix(id, 'SIGNATORY#') ?? id,
      },
    ];
  });
}
