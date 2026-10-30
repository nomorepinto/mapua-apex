import {
  AdminGetUserCommand,
  ListGroupsCommand,
  ListUsersCommand,
  UserNotFoundException,
  type CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppConfigService } from '../config/app-config.service.js';
import { SIGNATORY_ATTRIBUTE } from './account-groups.js';
import { CognitoAccountsRepository } from './cognito-accounts.repository.js';

function repository(
  poolId: string,
  send: (command: unknown) => Promise<unknown>,
): CognitoAccountsRepository {
  return new CognitoAccountsRepository(
    { send } as CognitoIdentityProviderClient,
    { userPoolId: () => poolId } as AppConfigService,
  );
}

describe('CognitoAccountsRepository', () => {
  it('pages through users and reads the custom attributes', async () => {
    let calls = 0;
    const repo = repository('pool-1', async (command) => {
      expect(command).toBeInstanceOf(ListUsersCommand);
      calls += 1;
      if (calls === 1) {
        return {
          Users: [
            {
              Username: 'ada@mapua.edu.ph',
              UserStatus: 'CONFIRMED',
              Enabled: true,
              Attributes: [
                { Name: 'sub', Value: 'ada-sub' },
                { Name: 'email', Value: 'ada@mapua.edu.ph' },
                { Name: 'name', Value: 'Ada' },
                { Name: SIGNATORY_ATTRIBUTE, Value: 'sig-1' },
              ],
            },
          ],
          PaginationToken: 'next',
        };
      }
      return { Users: [] };
    });

    const accounts = await repo.listAccounts();
    expect(calls).toBe(2);
    expect(accounts).toEqual([
      {
        username: 'ada@mapua.edu.ph',
        sub: 'ada-sub',
        email: 'ada@mapua.edu.ph',
        name: 'Ada',
        signatoryId: 'sig-1',
        organizationId: null,
        status: 'CONFIRMED',
      },
    ]);
  });

  it('matches custom attributes in memory without a ListUsers filter', async () => {
    const repo = repository('pool-1', async (command) => {
      expect(command).toBeInstanceOf(ListUsersCommand);
      expect((command as ListUsersCommand).input.Filter).toBeUndefined();
      return {
        Users: [
          {
            Username: 'ada@mapua.edu.ph',
            UserStatus: 'CONFIRMED',
            Enabled: true,
            Attributes: [
              { Name: 'sub', Value: 'ada-sub' },
              { Name: 'email', Value: 'ada@mapua.edu.ph' },
              { Name: SIGNATORY_ATTRIBUTE, Value: 'sig-1' },
            ],
          },
          {
            Username: 'other@mapua.edu.ph',
            UserStatus: 'CONFIRMED',
            Enabled: true,
            Attributes: [
              { Name: 'sub', Value: 'other-sub' },
              { Name: SIGNATORY_ATTRIBUTE, Value: 'sig-2' },
            ],
          },
        ],
      };
    });

    const matches = await repo.listByAttribute(SIGNATORY_ATTRIBUTE, 'sig-1');
    expect(matches.map((account) => account.username)).toEqual([
      'ada@mapua.edu.ph',
    ]);
  });

  it('returns null when AdminGetUser cannot find the username', async () => {
    const repo = repository('pool-1', async (command) => {
      expect(command).toBeInstanceOf(AdminGetUserCommand);
      throw new UserNotFoundException({
        message: 'User does not exist.',
        $metadata: {},
      });
    });
    await expect(repo.getByUsername('missing')).resolves.toBeNull();
  });

  it('lists group names', async () => {
    const repo = repository('pool-1', async (command) => {
      expect(command).toBeInstanceOf(ListGroupsCommand);
      return { Groups: [{ GroupName: 'Dean' }, { GroupName: 'OSAAR' }] };
    });
    await expect(repo.listGroups()).resolves.toEqual(['Dean', 'OSAAR']);
  });

  it('fails closed when the user pool id is empty', async () => {
    const repo = repository('', async () => {
      throw new Error('Cognito should not be called');
    });
    await expect(repo.listAccounts()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
