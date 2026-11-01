import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service.js';
import type { AccountView } from '../accounts/cognito-account.js';
import { CampusRepository } from '../campuses/campus.repository.js';
import { abort } from '../common/http.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { bool, list, num, str, type Item } from '../common/records.js';
import {
  SignatoryRepository,
  type OsaarPlacement,
} from './signatory.repository.js';

export interface SignatoryView {
  signatory_id: string;
  name: string;
  role: string;
  department: string | null;
  organization_id: null;
  campus_id: string | null;
  all_campuses: boolean;
  osaar_order: number | null;
}

@Injectable()
export class SignatoryService {
  private readonly logger = new Logger(SignatoryService.name);

  constructor(
    private readonly signatories: SignatoryRepository,
    private readonly accounts: AccountsService,
    private readonly campuses: CampusRepository,
  ) {}

  async list(): Promise<SignatoryView[]> {
    return (await this.signatories.list()).map((item) => this.toView(item));
  }

  async me(id: string): Promise<SignatoryView> {
    const item = await this.signatories.get(id);
    if (!item) {
      throw new NotFoundException('Signatory not found.');
    }
    return this.toView(item);
  }

  async create(
    name: string,
    role: string,
    department?: string | null,
    campusId?: string | null,
    allCampuses?: boolean,
  ): Promise<SignatoryView> {
    const placement = await this.placementFor(role, campusId, allCampuses);
    return this.toView(
      await this.signatories.create(name, role, department, placement),
    );
  }

  async update(
    id: string,
    name: string,
    role: string,
    department?: string | null,
    campusId?: string | null,
    allCampuses?: boolean,
  ): Promise<SignatoryView> {
    const existing = await this.signatories.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const previousRole = str(existing, 'role') ?? '';
    const placement = await this.placementFor(
      role,
      campusId,
      allCampuses,
      existing,
    );
    const updated = await this.signatories.update(
      id,
      name,
      role,
      department,
      placement,
    );
    const bare = stripPrefix(id, 'SIGNATORY#') ?? id;
    if (previousRole.toLowerCase() !== role.toLowerCase()) {
      await this.bestEffort(`signatory role ${bare}`, () =>
        this.accounts.syncSignatoryRole(bare, role),
      );
    }
    return this.toView(updated);
  }

  async assignAccount(
    id: string,
    username: string | null,
    callerSub: string,
  ): Promise<AccountView | null> {
    const existing = await this.signatories.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const bare = stripPrefix(id, 'SIGNATORY#') ?? id;
    return this.accounts.assignSignatory(
      bare,
      str(existing, 'role') ?? '',
      username,
      callerSub,
    );
  }

  async remove(id: string): Promise<void> {
    const existing = await this.signatories.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const bare = stripPrefix(id, 'SIGNATORY#') ?? id;
    const organizations = await this.signatories.listOrganizations();
    const onDesk = organizations.some((org) =>
      list(org, 'signatories').some((desk) => {
        const row = desk as Item;
        return str(row, 'signatory_id') === bare;
      }),
    );
    if (onDesk) {
      abort(
        409,
        'This signatory is still assigned to an organization desk and cannot be deleted.',
      );
    }
    if (await this.signatories.hasOpenSubmissions(bare)) {
      abort(
        409,
        'This signatory still has submissions awaiting review and cannot be deleted.',
      );
    }
    await this.bestEffort(`signatory release ${bare}`, () =>
      this.accounts.releaseSignatory(bare, str(existing, 'role') ?? ''),
    );
    await this.signatories.delete(bare);
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

  async requireExisting(id: string): Promise<void> {
    const item = await this.signatories.get(id);
    if (!item) {
      abort(422, 'The selected signatory does not exist.');
    }
  }

  toView(item: Item): SignatoryView {
    return {
      signatory_id: stripPrefix(item.PK, 'SIGNATORY#') ?? '',
      name: str(item, 'name') ?? '',
      role: str(item, 'role') ?? '',
      department: str(item, 'department'),
      organization_id: null,
      campus_id: str(item, 'campus_id'),
      all_campuses: bool(item, 'all_campuses'),
      osaar_order: num(item, 'osaar_order'),
    };
  }

  private async placementFor(
    role: string,
    campusId: string | null | undefined,
    allCampuses: boolean | undefined,
    existing?: Item,
  ): Promise<OsaarPlacement | null> {
    if (role.toLowerCase() !== 'osaar') {
      return null;
    }
    const all = allCampuses === true;
    const campus = campusId ? stripPrefix(campusId, 'CAMPUS#') : null;
    if (all && campus) {
      abort(
        422,
        'An all-campus OSAAR signatory cannot also belong to one campus.',
      );
    }
    if (!all && !campus) {
      abort(
        422,
        'An OSAAR signatory must belong to a campus or be the all-campus OSAAR.',
      );
    }
    if (all) {
      await this.assertOnlyAllCampus(existing);
      return { campusId: null, allCampuses: true, osaarOrder: null };
    }
    const campusItem = await this.campuses.get(campus as string);
    if (!campusItem) {
      abort(422, 'The selected campus does not exist.');
    }
    const previousCampus = existing ? str(existing, 'campus_id') : null;
    const previousOrder = existing ? num(existing, 'osaar_order') : null;
    const sameCampus =
      existing !== undefined &&
      str(existing, 'role') === 'osaar' &&
      !bool(existing, 'all_campuses') &&
      previousCampus === campus &&
      previousOrder !== null;
    const order = sameCampus
      ? previousOrder
      : await this.nextOrder(campus as string);
    return { campusId: campus, allCampuses: false, osaarOrder: order };
  }

  private async assertOnlyAllCampus(existing?: Item): Promise<void> {
    const current = existing ? stripPrefix(existing.PK, 'SIGNATORY#') : null;
    const people = await this.signatories.listByRole('osaar');
    const taken = people.some((person) => {
      if (!bool(person, 'all_campuses')) {
        return false;
      }
      return stripPrefix(person.PK, 'SIGNATORY#') !== current;
    });
    if (taken) {
      abort(422, 'An all-campus OSAAR signatory already exists.');
    }
  }

  private async nextOrder(campusId: string): Promise<number> {
    const people = await this.signatories.listByRole('osaar');
    let max = 0;
    for (const person of people) {
      if (
        str(person, 'campus_id') !== campusId ||
        bool(person, 'all_campuses')
      ) {
        continue;
      }
      max = Math.max(max, num(person, 'osaar_order') ?? 0);
    }
    return max + 1;
  }
}
