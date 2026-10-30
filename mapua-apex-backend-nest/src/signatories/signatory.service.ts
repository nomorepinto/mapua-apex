import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service.js';
import type { AccountView } from '../accounts/cognito-account.js';
import { abort } from '../common/http.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { list, str, type Item } from '../common/records.js';
import { SignatoryRepository } from './signatory.repository.js';

export interface SignatoryView {
  signatory_id: string;
  name: string;
  role: string;
  department: string | null;
  organization_id: null;
}

@Injectable()
export class SignatoryService {
  private readonly logger = new Logger(SignatoryService.name);

  constructor(
    private readonly signatories: SignatoryRepository,
    private readonly accounts: AccountsService,
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
  ): Promise<SignatoryView> {
    return this.toView(await this.signatories.create(name, role, department));
  }

  async update(
    id: string,
    name: string,
    role: string,
    department?: string | null,
  ): Promise<SignatoryView> {
    const existing = await this.signatories.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const previousRole = str(existing, 'role') ?? '';
    const updated = await this.signatories.update(id, name, role, department);
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
    };
  }
}
