import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_ATTRIBUTE,
  SIGNATORY_ATTRIBUTE,
} from './account-groups.js';
import { AccountsService } from './accounts.service.js';
import type { CognitoAccount } from './cognito-account.js';
import type { CognitoAccountsRepository } from './cognito-accounts.repository.js';

const GROUPS = [
  'Dean',
  'ORG_Adviser',
  'CDM_Reviewer',
  'OSAAR',
  'org_submitter',
];

function account(
  partial: Partial<CognitoAccount> & Pick<CognitoAccount, 'username' | 'sub'>,
): CognitoAccount {
  return {
    email: null,
    name: null,
    signatoryId: null,
    organizationId: null,
    status: 'CONFIRMED',
    ...partial,
  };
}

function harness(groupNames: string[] = GROUPS) {
  const users = new Map<string, CognitoAccount>();
  const membership = new Map<string, Set<string>>();
  const attributes: string[] = [];

  function userOf(username: string): CognitoAccount {
    const user = users.get(username);
    if (!user) {
      throw new Error(`missing ${username}`);
    }
    return user;
  }

  const cognito: Pick<
    CognitoAccountsRepository,
    | 'listAccounts'
    | 'listByAttribute'
    | 'listGroups'
    | 'getByUsername'
    | 'setAttribute'
    | 'deleteAttribute'
    | 'addToGroup'
    | 'removeFromGroup'
  > = {
    async listAccounts(): Promise<CognitoAccount[]> {
      return [...users.values()];
    },
    async listByAttribute(attribute, value): Promise<CognitoAccount[]> {
      return [...users.values()].filter((user) =>
        attribute === SIGNATORY_ATTRIBUTE
          ? user.signatoryId === value
          : user.organizationId === value,
      );
    },
    async listGroups(): Promise<string[]> {
      return groupNames;
    },
    async getByUsername(username): Promise<CognitoAccount | null> {
      return users.get(username) ?? null;
    },
    async setAttribute(username, name, value): Promise<void> {
      attributes.push(`set ${username} ${name}`);
      const user = userOf(username);
      if (name === SIGNATORY_ATTRIBUTE) {
        user.signatoryId = value;
      }
      if (name === ORGANIZATION_ATTRIBUTE) {
        user.organizationId = value;
      }
    },
    async deleteAttribute(username, name): Promise<void> {
      attributes.push(`delete ${username} ${name}`);
      const user = userOf(username);
      if (name === SIGNATORY_ATTRIBUTE) {
        user.signatoryId = null;
      }
      if (name === ORGANIZATION_ATTRIBUTE) {
        user.organizationId = null;
      }
    },
    async addToGroup(username, group): Promise<void> {
      const groups = membership.get(username) ?? new Set<string>();
      groups.add(group);
      membership.set(username, groups);
    },
    async removeFromGroup(username, group): Promise<void> {
      membership.get(username)?.delete(group);
    },
  };

  return {
    users,
    membership,
    attributes,
    service: new AccountsService(cognito as CognitoAccountsRepository),
  };
}

describe('AccountsService', () => {
  it('moves the account onto the signatory and clears the previous holder', async () => {
    const { users, membership, service } = harness();
    users.set(
      'old@mapua.edu.ph',
      account({
        username: 'old@mapua.edu.ph',
        sub: 'old-sub',
        name: 'Old Dean',
        signatoryId: 'sig-1',
      }),
    );
    users.set(
      'new@mapua.edu.ph',
      account({
        username: 'new@mapua.edu.ph',
        sub: 'new-sub',
        email: 'new@mapua.edu.ph',
        organizationId: 'org-9',
      }),
    );
    membership.set('old@mapua.edu.ph', new Set(['Dean']));
    membership.set('new@mapua.edu.ph', new Set(['org_submitter', 'admin']));

    const assigned = await service.assignSignatory(
      'sig-1',
      'dean',
      'new@mapua.edu.ph',
      'caller-sub',
    );

    expect(assigned).toMatchObject({
      username: 'new@mapua.edu.ph',
      signatory_id: 'sig-1',
      organization_id: null,
    });
    expect(users.get('old@mapua.edu.ph')).toMatchObject({
      signatoryId: null,
    });
    expect(membership.get('old@mapua.edu.ph')?.has('Dean')).toBe(false);
    expect(membership.get('new@mapua.edu.ph')).toEqual(
      new Set(['admin', 'Dean']),
    );
  });

  it('clears every holder when the account is unassigned', async () => {
    const { users, membership, service } = harness();
    users.set(
      'old@mapua.edu.ph',
      account({
        username: 'old@mapua.edu.ph',
        sub: 'old-sub',
        organizationId: 'org-1',
      }),
    );
    membership.set('old@mapua.edu.ph', new Set(['org_submitter']));

    await expect(
      service.assignOrganization('org-1', null, 'caller-sub'),
    ).resolves.toBeNull();
    expect(users.get('old@mapua.edu.ph')?.organizationId).toBeNull();
    expect(membership.get('old@mapua.edu.ph')?.size).toBe(0);
  });

  it('refuses to change the caller own account', async () => {
    const { users, attributes, service } = harness();
    users.set(
      'me@mapua.edu.ph',
      account({
        username: 'me@mapua.edu.ph',
        sub: 'caller-sub',
        signatoryId: 'sig-1',
      }),
    );

    await expect(
      service.assignSignatory('sig-1', 'dean', null, 'caller-sub'),
    ).rejects.toMatchObject({
      response: {
        message: 'You cannot change the Cognito account assigned to yourself.',
      },
    });
    expect(attributes).toEqual([]);
    expect(users.get('me@mapua.edu.ph')?.signatoryId).toBe('sig-1');
  });

  it('returns 404 when the username is not in the pool', async () => {
    const { service } = harness();
    await expect(
      service.assignOrganization('org-1', 'missing@mapua.edu.ph', 'caller-sub'),
    ).rejects.toMatchObject({
      response: { message: 'Cognito account not found.' },
    });
  });

  it('refuses a signatory role that has no managed group', async () => {
    const { service } = harness();
    await expect(
      service.assignSignatory(
        'sig-1',
        'admin',
        'someone@mapua.edu.ph',
        'caller',
      ),
    ).rejects.toMatchObject({
      response: { message: 'This signatory role has no Cognito group.' },
    });
  });

  it('does not write attributes when a managed group is missing', async () => {
    const { users, attributes, service } = harness(
      GROUPS.filter((group) => group !== 'Dean'),
    );
    users.set(
      'new@mapua.edu.ph',
      account({ username: 'new@mapua.edu.ph', sub: 'new-sub' }),
    );

    await expect(
      service.assignSignatory(
        'sig-1',
        'dean',
        'new@mapua.edu.ph',
        'caller-sub',
      ),
    ).rejects.toMatchObject({
      response: { message: 'Cognito group "dean" does not exist.' },
    });
    expect(attributes).toEqual([]);
    expect(users.get('new@mapua.edu.ph')?.signatoryId).toBeNull();
  });

  it('moves holders into the new role group without changing the attribute', async () => {
    const { users, membership, service } = harness();
    users.set(
      'dean@mapua.edu.ph',
      account({
        username: 'dean@mapua.edu.ph',
        sub: 'dean-sub',
        signatoryId: 'sig-1',
      }),
    );
    membership.set('dean@mapua.edu.ph', new Set(['Dean']));

    await service.syncSignatoryRole('sig-1', 'osaar');

    expect(users.get('dean@mapua.edu.ph')?.signatoryId).toBe('sig-1');
    expect(membership.get('dean@mapua.edu.ph')).toEqual(new Set(['OSAAR']));
  });
});
