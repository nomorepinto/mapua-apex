import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { abort } from '../common/http.js';
import { organizationKey, stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';
import type { DeskDto } from './dto/organization.dto.js';
import {
  desksOf,
  OrganizationRepository,
  type Desk,
} from './organization.repository.js';

export interface OrganizationView {
  organization_id: string;
  name: string;
  department: string | null;
  is_higher_council: boolean;
  signatories: Desk[];
}

export interface OrganizationDirectoryEntry {
  organization_id: string;
  name: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly signatories: SignatoryRepository,
  ) {}

  async directory(): Promise<OrganizationDirectoryEntry[]> {
    return (await this.organizations.list()).map((item) => ({
      organization_id: stripPrefix(item.PK, 'ORGANIZATION#') ?? '',
      name: str(item, 'name') ?? '',
    }));
  }

  async list(): Promise<OrganizationView[]> {
    return (await this.organizations.list()).map((item) =>
      this.toView(item, null),
    );
  }

  async showForStudent(organizationId: string): Promise<OrganizationView> {
    const item = await this.organizations.get(organizationId);
    if (!item) {
      throw new NotFoundException('Organization not found.');
    }
    const dean = desksOf(item).find((desk) => desk.role === 'dean');
    let department: string | null = null;
    if (dean) {
      const person = await this.signatories.get(dean.signatory_id);
      const raw = person ? str(person, 'department') : null;
      department = raw ? raw.trim().toUpperCase() : null;
    }
    return this.toView(item, department);
  }

  async create(
    name: string,
    higherCouncil: boolean | undefined,
    desks: DeskDto[] | undefined,
  ): Promise<OrganizationView> {
    const ordered = await this.checkedDesks(desks ?? []);
    const item = await this.organizations.create(
      name,
      ordered,
      higherCouncil === true,
    );
    return this.toView(item, null);
  }

  async update(
    id: string,
    name: string,
    higherCouncil: boolean | undefined,
    desks: DeskDto[],
  ): Promise<OrganizationView> {
    const existing = await this.organizations.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const ordered = await this.checkedDesks(desks);
    const keepHigher =
      higherCouncil === undefined
        ? existing.is_higher_council === true
        : higherCouncil;
    const item = await this.organizations.update(id, name, ordered, keepHigher);
    return this.toView({ ...existing, ...item }, null);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.organizations.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const bare = stripPrefix(id, 'ORGANIZATION#') ?? id;
    if (
      (await this.organizations.hasEvents(bare)) ||
      (await this.organizations.hasPrefix(bare, 'COLLAB#'))
    ) {
      abort(
        409,
        'This organization still has submissions and cannot be deleted.',
      );
    }
    if (await this.organizations.hasPrefix(bare, 'MEMBER#')) {
      abort(
        409,
        'This organization still has member rosters in the attendance system.',
      );
    }
    await this.organizations.delete(bare);
  }

  async require(id: string): Promise<Item> {
    const item = await this.organizations.get(id);
    if (!item) {
      abort(422, 'The selected organization does not exist.');
    }
    return item;
  }

  private async checkedDesks(desks: DeskDto[]): Promise<Desk[]> {
    const roles = new Set<string>();
    const ids = new Set<string>();
    const errors: Record<string, string[]> = {};
    desks.forEach((desk, index) => {
      const role = desk.role.toLowerCase();
      const id =
        stripPrefix(desk.signatory_id, 'SIGNATORY#') ?? desk.signatory_id;
      if (roles.has(role)) {
        errors[`signatories.${index}.role`] = [
          'The role field has a duplicate value.',
        ];
      }
      roles.add(role);
      if (ids.has(id)) {
        errors[`signatories.${index}.signatory_id`] = [
          'The signatory id field has a duplicate value.',
        ];
      }
      ids.add(id);
    });
    if (Object.keys(errors).length > 0) {
      throw new UnprocessableEntityException({
        message: Object.values(errors)[0]?.[0] ?? 'The given data was invalid.',
        errors,
      });
    }
    for (const [index, desk] of desks.entries()) {
      const person = await this.signatories.get(desk.signatory_id);
      if (!person) {
        throw new UnprocessableEntityException({
          message: 'The selected signatory does not exist.',
          errors: {
            [`signatories.${index}.signatory_id`]: [
              'The selected signatory does not exist.',
            ],
          },
        });
      }
    }
    return desks.map((desk) => ({
      role: desk.role.toLowerCase(),
      signatory_id:
        stripPrefix(desk.signatory_id, 'SIGNATORY#') ?? desk.signatory_id,
    }));
  }

  private toView(item: Item, department: string | null): OrganizationView {
    return {
      organization_id:
        stripPrefix(item.PK, 'ORGANIZATION#') ??
        stripPrefix(organizationKey(String(item.PK ?? '')), 'ORGANIZATION#') ??
        '',
      name: str(item, 'name') ?? '',
      department,
      is_higher_council: item.is_higher_council === true,
      signatories: desksOf(item),
    };
  }
}
