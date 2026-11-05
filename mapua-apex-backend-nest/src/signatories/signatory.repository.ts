import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DynamoTable } from '../aws/dynamo-table.js';
import { roleIndex, signatoryKey, stripPrefix } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';

/** Campus membership for an OSAAR account. Other roles leave this unset. */
export interface OsaarPlacement {
  campusId: string | null;
  allCampuses: boolean;
  osaarOrder: number | null;
}

/** Desk contact details a proponent may use to follow up. All optional. */
export interface SignatoryContact {
  email: string | null;
  office: string | null;
  number: string | null;
}

export const NO_CONTACT: SignatoryContact = {
  email: null,
  office: null,
  number: null,
};

/** Trims each field and drops blanks so a cleared field is removed on write. */
export function normalizeContact(
  contact?: SignatoryContact | null,
): SignatoryContact {
  return {
    email: text(contact?.email),
    office: text(contact?.office),
    number: text(contact?.number),
  };
}

function text(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class SignatoryRepository {
  constructor(private readonly table: DynamoTable) {}

  list(): Promise<Item[]> {
    return this.table.scan({
      filter: 'begins_with(PK, :pk) AND PK = SK',
      values: { ':pk': 'SIGNATORY#' },
      maxItems: 100,
      // Read-after-write: the admin UI refetches this list immediately after a
      // create/update, so a strongly-consistent scan keeps the new row visible.
      consistent: true,
    });
  }

  get(id: string): Promise<Item | undefined> {
    const key = signatoryKey(id);
    return this.table.get(key, key);
  }

  /**
   * Signatory rows for a list of bare ids in one `BatchGetItem`. Missing desks
   * are simply absent from the result.
   */
  listByIds(ids: string[]): Promise<Item[]> {
    const keys = [
      ...new Set(
        ids
          .map((id) => text(id))
          .filter((id): id is string => id !== null)
          .map((id) => signatoryKey(id)),
      ),
    ].map((key) => ({ PK: key, SK: key }));
    if (keys.length === 0) {
      return Promise.resolve([]);
    }
    return this.table.batchGet(keys);
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
    const items = await this.listByRole(role, limit);
    return items.flatMap((item) => {
      const id = stripPrefix(item.PK, 'SIGNATORY#');
      return id ? [id] : [];
    });
  }

  /** Every signatory with this role. Dean rows without a department only. */
  listByRole(role: string, limit?: number): Promise<Item[]> {
    return this.table.query({
      index: 'GSI4',
      keyCondition: 'GSI4PK = :role',
      values: { ':role': roleIndex(role) },
      ...(limit ? { limit, allPages: false } : {}),
    });
  }

  async create(
    name: string,
    role: string,
    department?: string | null,
    placement?: OsaarPlacement | null,
    contact?: SignatoryContact | null,
  ): Promise<Item> {
    return this.write(randomUUID(), name, role, department, placement, contact);
  }

  async update(
    id: string,
    name: string,
    role: string,
    department?: string | null,
    placement?: OsaarPlacement | null,
    contact?: SignatoryContact | null,
  ): Promise<Item> {
    return this.write(
      stripPrefix(id, 'SIGNATORY#') ?? id,
      name,
      role,
      department,
      placement,
      contact,
    );
  }

  async setOsaarOrder(id: string, order: number): Promise<void> {
    const key = signatoryKey(id);
    await this.table.update({
      key: { PK: key, SK: key },
      set: { osaar_order: order },
    });
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
      consistent: true,
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
    placement?: OsaarPlacement | null,
    contact?: SignatoryContact | null,
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
    // `put` replaces the row, so a blank field is dropped rather than stored.
    const details = normalizeContact(contact);
    if (details.email !== null) {
      item.contact_email = details.email;
    }
    if (details.office !== null) {
      item.office = details.office;
    }
    if (details.number !== null) {
      item.contact_number = details.number;
    }
    if (normalized === 'osaar' && placement?.allCampuses) {
      item.all_campuses = true;
    } else if (normalized === 'osaar' && placement?.campusId) {
      item.campus_id = placement.campusId;
      if (placement.osaarOrder !== null) {
        item.osaar_order = placement.osaarOrder;
      }
    }
    await this.table.put(item);
    return item;
  }
}
