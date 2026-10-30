import { Injectable, NotFoundException } from '@nestjs/common';
import { abort } from '../common/http.js';
import {
  MANAGED_GROUPS,
  ORGANIZATION_ATTRIBUTE,
  ORGANIZATION_GROUP,
  SIGNATORY_ATTRIBUTE,
  SIGNATORY_GROUP_BY_ROLE,
} from './account-groups.js';
import type { AccountView, CognitoAccount } from './cognito-account.js';
import { CognitoAccountsRepository } from './cognito-accounts.repository.js';

@Injectable()
export class AccountsService {
  private groupNames: Map<string, string> | null = null;

  constructor(private readonly cognito: CognitoAccountsRepository) {}

  async list(): Promise<AccountView[]> {
    const accounts = await this.cognito.listAccounts();
    return accounts
      .map((account) => toView(account))
      .sort((left, right) => labelOf(left).localeCompare(labelOf(right)));
  }

  async assignSignatory(
    signatoryId: string,
    role: string,
    username: string | null,
    callerSub: string,
  ): Promise<AccountView | null> {
    const logical = SIGNATORY_GROUP_BY_ROLE[role.toLowerCase()];
    if (!logical) {
      abort(422, 'This signatory role has no Cognito group.');
    }
    return this.assign(
      SIGNATORY_ATTRIBUTE,
      signatoryId,
      logical,
      username,
      callerSub,
    );
  }

  async assignOrganization(
    organizationId: string,
    username: string | null,
    callerSub: string,
  ): Promise<AccountView | null> {
    return this.assign(
      ORGANIZATION_ATTRIBUTE,
      organizationId,
      ORGANIZATION_GROUP,
      username,
      callerSub,
    );
  }

  /** Best-effort cleanup after a signatory row is removed. */
  async releaseSignatory(signatoryId: string, role: string): Promise<void> {
    const logical = SIGNATORY_GROUP_BY_ROLE[role.toLowerCase()] ?? null;
    await this.clearHolders(SIGNATORY_ATTRIBUTE, signatoryId, logical);
  }

  /** Best-effort cleanup after an organization row is removed. */
  async releaseOrganization(organizationId: string): Promise<void> {
    await this.clearHolders(
      ORGANIZATION_ATTRIBUTE,
      organizationId,
      ORGANIZATION_GROUP,
    );
  }

  /**
   * Move every account linked to this signatory into the group for `role`.
   * The custom attribute stays. An unmapped role only leaves the managed groups.
   */
  async syncSignatoryRole(signatoryId: string, role: string): Promise<void> {
    const logical = SIGNATORY_GROUP_BY_ROLE[role.toLowerCase()] ?? null;
    await this.requireManagedGroups();
    const target = logical ? await this.requireGroup(logical) : null;
    const holders = await this.cognito.listByAttribute(
      SIGNATORY_ATTRIBUTE,
      guardedId(signatoryId),
    );
    for (const holder of holders) {
      await this.keepOnlyGroup(holder.username, target);
    }
  }

  private async assign(
    attribute: typeof SIGNATORY_ATTRIBUTE | typeof ORGANIZATION_ATTRIBUTE,
    targetId: string,
    logicalGroup: string,
    username: string | null,
    callerSub: string,
  ): Promise<AccountView | null> {
    const id = guardedId(targetId);
    await this.requireManagedGroups();
    const targetGroup = await this.requireGroup(logicalGroup);
    const chosen = username ? await this.requireAccount(username) : null;
    const holders = await this.cognito.listByAttribute(attribute, id);
    this.rejectOwnAccount(callerSub, chosen, holders);
    await this.clearHolders(attribute, id, logicalGroup, chosen?.username);
    if (!chosen) {
      return null;
    }
    const other =
      attribute === SIGNATORY_ATTRIBUTE
        ? ORGANIZATION_ATTRIBUTE
        : SIGNATORY_ATTRIBUTE;
    await this.cognito.setAttribute(chosen.username, attribute, id);
    if (
      (other === SIGNATORY_ATTRIBUTE && chosen.signatoryId) ||
      (other === ORGANIZATION_ATTRIBUTE && chosen.organizationId)
    ) {
      await this.cognito.deleteAttribute(chosen.username, other);
    }
    await this.keepOnlyGroup(chosen.username, targetGroup);
    return toView({
      ...chosen,
      signatoryId: attribute === SIGNATORY_ATTRIBUTE ? id : null,
      organizationId: attribute === ORGANIZATION_ATTRIBUTE ? id : null,
    });
  }

  private async clearHolders(
    attribute: typeof SIGNATORY_ATTRIBUTE | typeof ORGANIZATION_ATTRIBUTE,
    targetId: string,
    logicalGroup: string | null,
    exceptUsername?: string,
  ): Promise<void> {
    const holders = await this.cognito.listByAttribute(
      attribute,
      guardedId(targetId),
    );
    const group = logicalGroup ? await this.lookupGroup(logicalGroup) : null;
    for (const holder of holders) {
      if (holder.username === exceptUsername) {
        continue;
      }
      await this.cognito.deleteAttribute(holder.username, attribute);
      if (group) {
        await this.cognito.removeFromGroup(holder.username, group);
      }
    }
  }

  private async keepOnlyGroup(
    username: string,
    targetGroup: string | null,
  ): Promise<void> {
    for (const logical of MANAGED_GROUPS) {
      const actual = await this.requireGroup(logical);
      if (actual !== targetGroup) {
        await this.cognito.removeFromGroup(username, actual);
      }
    }
    if (targetGroup) {
      await this.cognito.addToGroup(username, targetGroup);
    }
  }

  private async requireAccount(username: string): Promise<CognitoAccount> {
    const account = await this.cognito.getByUsername(username);
    if (!account) {
      throw new NotFoundException('Cognito account not found.');
    }
    return account;
  }

  private rejectOwnAccount(
    callerSub: string,
    chosen: CognitoAccount | null,
    holders: readonly CognitoAccount[],
  ): void {
    const touchesCaller =
      chosen?.sub === callerSub ||
      holders.some(
        (holder) =>
          holder.sub === callerSub && holder.username !== chosen?.username,
      );
    if (touchesCaller) {
      abort(422, 'You cannot change the Cognito account assigned to yourself.');
    }
  }

  private async requireManagedGroups(): Promise<void> {
    for (const logical of MANAGED_GROUPS) {
      await this.requireGroup(logical);
    }
  }

  private async requireGroup(logical: string): Promise<string> {
    const actual = await this.lookupGroup(logical);
    if (!actual) {
      abort(422, `Cognito group "${logical}" does not exist.`);
    }
    return actual;
  }

  private async lookupGroup(logical: string): Promise<string | null> {
    if (!this.groupNames) {
      const names = await this.cognito.listGroups();
      this.groupNames = new Map(
        names.map((name) => [name.toLowerCase(), name]),
      );
    }
    return this.groupNames.get(logical.toLowerCase()) ?? null;
  }
}

function guardedId(value: string): string {
  if (value.includes('"') || value.includes('\\')) {
    abort(422, 'The selected id cannot be matched to a Cognito account.');
  }
  return value;
}

function toView(account: CognitoAccount): AccountView {
  return {
    username: account.username,
    sub: account.sub,
    email: account.email,
    name: account.name,
    signatory_id: account.signatoryId,
    organization_id: account.organizationId,
    status: account.status,
  };
}

function labelOf(account: AccountView): string {
  return (account.name ?? account.email ?? account.username).toLowerCase();
}
