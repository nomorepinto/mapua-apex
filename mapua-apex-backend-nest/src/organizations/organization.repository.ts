import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DynamoTable } from '../aws/dynamo-table.js';
import { officerKey, organizationKey, stripPrefix } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';
import type { CreateOfficerDto, UpdateOfficerDto } from './dto/officer.dto.js';

const MAX_OFFICERS = 50;

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
    positionRoles?: string[],
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
    if (positionRoles && positionRoles.length > 0) {
      item['position_roles'] = positionRoles;
    }
    await this.table.put(item);
    return item;
  }

  update(
    id: string,
    name: string,
    desks: Desk[],
    skipDean: boolean,
    skipPostEval: boolean,
    positionRoles?: string[],
  ): Promise<Item> {
    const key = organizationKey(id);
    const set: Record<string, unknown> = {
      name,
      skip_dean: skipDean,
      skip_post_eval: skipPostEval,
      signatories: orderDesks(desks),
    };
    if (positionRoles !== undefined) {
      set['position_roles'] = positionRoles;
    }
    return this.table.update({
      key: { PK: key, SK: key },
      set,
    });
  }

  /** Targeted patch: replaces only the position_roles attribute. */
  patchRoles(id: string, positionRoles: string[]): Promise<Item> {
    const key = organizationKey(id);
    return this.table.update({
      key: { PK: key, SK: key },
      set: { position_roles: positionRoles },
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

  // ── Officer roster ──────────────────────────────────────────────────────────

  async listOfficers(orgId: string): Promise<Item[]> {
    return this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': organizationKey(orgId), ':sk': 'OFFICER#' },
      allPages: true,
    });
  }

  async createOfficer(orgId: string, dto: CreateOfficerDto): Promise<Item> {
    // Enforce capacity: count existing officers first.
    const existing = await this.listOfficers(orgId);
    if (existing.length >= MAX_OFFICERS) {
      throw new Error(
        `Officer roster is full (maximum ${MAX_OFFICERS} officers).`,
      );
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const item: Item = {
      PK: organizationKey(orgId),
      SK: officerKey(id),
      first_name: dto.first_name,
      last_name: dto.last_name,
      student_number: dto.student_number,
      program_and_year: dto.program_and_year,
      position_of_applicant: dto.position_of_applicant,
      contact_number: dto.contact_number,
      email_address: dto.email_address,
      facebook_link: dto.facebook_link,
      created_at: now,
      updated_at: now,
    };
    if (dto.middle_name) item['middle_name'] = dto.middle_name;
    if (dto.suffix) item['suffix'] = dto.suffix;
    if (dto.department) item['department'] = dto.department;
    await this.table.put(item);
    return item;
  }

  async updateOfficer(
    orgId: string,
    officerId: string,
    dto: UpdateOfficerDto,
  ): Promise<Item> {
    const pk = organizationKey(orgId);
    const sk = officerKey(officerId);
    const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (dto.first_name !== undefined) set['first_name'] = dto.first_name;
    if (dto.middle_name !== undefined) set['middle_name'] = dto.middle_name;
    if (dto.last_name !== undefined) set['last_name'] = dto.last_name;
    if (dto.suffix !== undefined) set['suffix'] = dto.suffix;
    if (dto.student_number !== undefined) set['student_number'] = dto.student_number;
    if (dto.program_and_year !== undefined) set['program_and_year'] = dto.program_and_year;
    if (dto.department !== undefined) set['department'] = dto.department;
    if (dto.position_of_applicant !== undefined) set['position_of_applicant'] = dto.position_of_applicant;
    if (dto.contact_number !== undefined) set['contact_number'] = dto.contact_number;
    if (dto.email_address !== undefined) set['email_address'] = dto.email_address;
    if (dto.facebook_link !== undefined) set['facebook_link'] = dto.facebook_link;
    return this.table.update({ key: { PK: pk, SK: sk }, set });
  }

  deleteOfficer(orgId: string, officerId: string): Promise<void> {
    return this.table.delete(organizationKey(orgId), officerKey(officerId));
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
