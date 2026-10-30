import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DynamoTable } from '../aws/dynamo-table.js';
import { roleIndex, signatoryKey, stripPrefix } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';

@Injectable()
export class SignatoryRepository {
  constructor(private readonly table: DynamoTable) {}

  list(): Promise<Item[]> {
    return this.table.scan({
      filter: 'begins_with(PK, :pk) AND PK = SK',
      values: { ':pk': 'SIGNATORY#' },
      maxItems: 100,
    });
  }

  get(id: string): Promise<Item | undefined> {
    const key = signatoryKey(id);
    return this.table.get(key, key);
  }

  async findIdByRole(role: string): Promise<string | null> {
    const ids = await this.listIdsByRole(role, 2);
    if (ids.length !== 1) {
      return null;
    }
    return ids[0] ?? null;
  }

  /** Every signatory id with this role. Dean rows are keyed per department. */
  async listIdsByRole(role: string, limit?: number): Promise<string[]> {
    const items = await this.table.query({
      index: 'GSI4',
      keyCondition: 'GSI4PK = :role',
      values: { ':role': roleIndex(role) },
      ...(limit ? { limit, allPages: false } : {}),
    });
    return items.flatMap((item) => {
      const id = stripPrefix(item.PK, 'SIGNATORY#');
      return id ? [id] : [];
    });
  }

  async create(
    name: string,
    role: string,
    department?: string | null,
  ): Promise<Item> {
    return this.write(randomUUID(), name, role, department);
  }

  async update(
    id: string,
    name: string,
    role: string,
    department?: string | null,
  ): Promise<Item> {
    return this.write(
      stripPrefix(id, 'SIGNATORY#') ?? id,
      name,
      role,
      department,
    );
  }

  delete(id: string): Promise<void> {
    const key = signatoryKey(id);
    return this.table.delete(key, key);
  }

  /** Used by the guarded delete. Organizations are identity rows only. */
  listOrganizations(): Promise<Item[]> {
    return this.table.scan({
      filter: 'begins_with(PK, :pk) AND PK = SK',
      values: { ':pk': 'ORGANIZATION#' },
      maxItems: 100,
    });
  }

  hasOpenSubmissions(id: string): Promise<boolean> {
    return this.table
      .query({
        index: 'GSI2',
        keyCondition: 'GSI2PK = :pk',
        values: { ':pk': signatoryKey(id) },
        limit: 1,
        allPages: false,
      })
      .then((items) => items.length > 0);
  }

  private async write(
    id: string,
    name: string,
    role: string,
    department?: string | null,
  ): Promise<Item> {
    const normalized = role.toLowerCase();
    const dept =
      normalized === 'dean' &&
      typeof department === 'string' &&
      department.trim() !== ''
        ? department.trim().toUpperCase()
        : undefined;
    const key = signatoryKey(id);
    const item: Item = {
      PK: key,
      SK: key,
      name,
      role: normalized,
      GSI4PK: roleIndex(normalized, dept),
      GSI4SK: key,
      ...(dept ? { department: dept } : {}),
    };
    await this.table.put(item);
    return item;
  }
}
