import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service.js';
import type { AccountView } from '../accounts/cognito-account.js';
import { abort } from '../common/http.js';
import { organizationKey, stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';
import type { DeskDto } from './dto/organization.dto.js';
import type { CreateOfficerDto, UpdateOfficerDto } from './dto/officer.dto.js';
import {
  desksOf,
  OrganizationRepository,
  type Desk,
} from './organization.repository.js';

export interface OrganizationView {
  organization_id: string;
  name: string;
  department: string | null;
  skip_dean: boolean;
  skip_post_eval: boolean;
  signatories: Desk[];
  position_roles: string[];
}

export interface OrganizationDirectoryEntry {
  organization_id: string;
  name: string;
}

export interface OfficerView {
  officer_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  student_number: string;
  program_and_year: string;
  department: string | null;
  position_of_applicant: string;
  contact_number: string;
  email_address: string;
  facebook_link: string;
  created_at: string | null;
  updated_at: string | null;
}

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly signatories: SignatoryRepository,
    private readonly accounts: AccountsService,
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
    skipDean: boolean | undefined,
    skipPostEval: boolean | undefined,
    desks: DeskDto[] | undefined,
    positionRoles?: string[],
  ): Promise<OrganizationView> {
    const ordered = await this.checkedDesks(desks ?? []);
    const item = await this.organizations.create(
      name,
      ordered,
      skipDean === true,
      skipPostEval === true,
      positionRoles,
    );
    return this.toView(item, null);
  }

  async update(
    id: string,
    name: string,
    skipDean: boolean | undefined,
    skipPostEval: boolean | undefined,
    desks: DeskDto[],
    positionRoles?: string[],
  ): Promise<OrganizationView> {
    const existing = await this.organizations.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const ordered = await this.checkedDesks(desks);
    const keepSkipDean =
      skipDean === undefined ? existing.skip_dean === true : skipDean;
    const keepSkipPostEval =
      skipPostEval === undefined
        ? existing.skip_post_eval === true
        : skipPostEval;
    const item = await this.organizations.update(
      id,
      name,
      ordered,
      keepSkipDean,
      keepSkipPostEval,
      positionRoles,
    );
    return this.toView({ ...existing, ...item }, null);
  }

  async patchRoles(
    organizationId: string,
    roles: string[],
  ): Promise<OrganizationView> {
    const existing = await this.organizations.get(organizationId);
    if (!existing) {
      throw new NotFoundException('Organization not found.');
    }
    await this.organizations.patchRoles(organizationId, roles);
    return this.showForStudent(organizationId);
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
    await this.bestEffort(`organization release ${bare}`, () =>
      this.accounts.releaseOrganization(bare),
    );
    await this.organizations.delete(bare);
  }

  async assignAccount(
    id: string,
    username: string | null,
    callerSub: string,
  ): Promise<AccountView | null> {
    const existing = await this.organizations.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const bare = stripPrefix(id, 'ORGANIZATION#') ?? id;
    return this.accounts.assignOrganization(bare, username, callerSub);
  }

  // ── Officer roster ──────────────────────────────────────────────────────────

  async listOfficers(organizationId: string): Promise<OfficerView[]> {
    const existing = await this.organizations.get(organizationId);
    if (!existing) {
      throw new NotFoundException('Organization not found.');
    }
    const items = await this.organizations.listOfficers(organizationId);
    return items.map((item) => this.toOfficerView(item));
  }

  async createOfficer(
    organizationId: string,
    dto: CreateOfficerDto,
  ): Promise<OfficerView> {
    const existing = await this.organizations.get(organizationId);
    if (!existing) {
      throw new NotFoundException('Organization not found.');
    }
    try {
      const item = await this.organizations.createOfficer(organizationId, dto);
      return this.toOfficerView(item);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Officer roster is full')) {
        abort(422, error.message);
      }
      throw error;
    }
  }

  async updateOfficer(
    organizationId: string,
    officerId: string,
    dto: UpdateOfficerDto,
  ): Promise<OfficerView> {
    const existing = await this.organizations.get(organizationId);
    if (!existing) {
      throw new NotFoundException('Organization not found.');
    }
    const item = await this.organizations.updateOfficer(
      organizationId,
      officerId,
      dto,
    );
    return this.toOfficerView(item);
  }

  async deleteOfficer(
    organizationId: string,
    officerId: string,
  ): Promise<void> {
    const existing = await this.organizations.get(organizationId);
    if (!existing) {
      throw new NotFoundException('Organization not found.');
    }
    await this.organizations.deleteOfficer(organizationId, officerId);
  }

  private toOfficerView(item: Item): OfficerView {
    return {
      officer_id: stripPrefix(item.SK, 'OFFICER#') ?? String(item.SK ?? ''),
      first_name: str(item, 'first_name') ?? '',
      middle_name: str(item, 'middle_name'),
      last_name: str(item, 'last_name') ?? '',
      suffix: str(item, 'suffix'),
      student_number: str(item, 'student_number') ?? '',
      program_and_year: str(item, 'program_and_year') ?? '',
      department: str(item, 'department'),
      position_of_applicant: str(item, 'position_of_applicant') ?? '',
      contact_number: str(item, 'contact_number') ?? '',
      email_address: str(item, 'email_address') ?? '',
      facebook_link: str(item, 'facebook_link') ?? '',
      created_at: str(item, 'created_at'),
      updated_at: str(item, 'updated_at'),
    };
  }

  private async bestEffort(
    label: string,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.warn(
        `${label} failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
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
    const rolesRaw = item.position_roles;
    const position_roles = Array.isArray(rolesRaw)
      ? rolesRaw.filter((r): r is string => typeof r === 'string')
      : [];
    return {
      organization_id:
        stripPrefix(item.PK, 'ORGANIZATION#') ??
        stripPrefix(organizationKey(String(item.PK ?? '')), 'ORGANIZATION#') ??
        '',
      name: str(item, 'name') ?? '',
      department,
      skip_dean: item.skip_dean === true,
      skip_post_eval: item.skip_post_eval === true,
      signatories: desksOf(item),
      position_roles,
    };
  }
}
