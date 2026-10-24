import { Injectable, NotFoundException } from '@nestjs/common';
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
  constructor(private readonly signatories: SignatoryRepository) {}

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
    return this.toView(
      await this.signatories.update(id, name, role, department),
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
    await this.signatories.delete(bare);
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
