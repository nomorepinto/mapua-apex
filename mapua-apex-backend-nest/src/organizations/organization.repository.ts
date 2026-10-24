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

  list(): Promise<Item[]> {
    return this.table.scan({
      filter: 'begins_with(PK, :pk) AND PK = SK',
      values: { ':pk': 'ORGANIZATION#' },
      maxItems: 100,
    });
  }

  get(id: string): Promise<Item | undefined> {
    const key = organizationKey(id);
    return this.table.get(key, key);
  }

  async create(
    name: string,
    desks: Desk[],
    higherCouncil: boolean,
  ): Promise<Item> {
    const id = randomUUID();
    const key = organizationKey(id);
    const item: Item = {
      PK: key,
      SK: key,
      name,
      is_higher_council: higherCouncil,
      signatories: orderDesks(desks),
    };
    await this.table.put(item);
    return item;
  }

  update(
    id: string,
    name: string,
    desks: Desk[],
    higherCouncil: boolean,
  ): Promise<Item> {
    const key = organizationKey(id);
    return this.table.update({
      key: { PK: key, SK: key },
      set: {
        name,
        is_higher_council: higherCouncil,
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
