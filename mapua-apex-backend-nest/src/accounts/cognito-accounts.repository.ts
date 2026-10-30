import {
  AdminAddUserToGroupCommand,
  AdminDeleteUserAttributesCommand,
  AdminGetUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListGroupsCommand,
  ListUsersCommand,
  UserNotFoundException,
  type AttributeType,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { COGNITO_IDP } from '../aws/dynamo.port.js';
import { AppConfigService } from '../config/app-config.service.js';
import {
  ORGANIZATION_ATTRIBUTE,
  SIGNATORY_ATTRIBUTE,
} from './account-groups.js';
import type { CognitoAccount } from './cognito-account.js';

const PAGE_SIZE = 60;

@Injectable()
export class CognitoAccountsRepository {
  private readonly logger = new Logger(CognitoAccountsRepository.name);

  constructor(
    @Inject(COGNITO_IDP)
    private readonly cognito: CognitoIdentityProviderClient,
    private readonly config: AppConfigService,
  ) {}

  async listAccounts(): Promise<CognitoAccount[]> {
    return this.listUsers();
  }

  async listByAttribute(
    attribute: typeof SIGNATORY_ATTRIBUTE | typeof ORGANIZATION_ATTRIBUTE,
    value: string,
  ): Promise<CognitoAccount[]> {
    return this.listUsers(`${attribute} = "${value}"`);
  }

  async listGroups(): Promise<string[]> {
    const names: string[] = [];
    let nextToken: string | undefined;
    do {
      const page = await this.cognito.send(
        new ListGroupsCommand({
          UserPoolId: this.poolId(),
          Limit: PAGE_SIZE,
          ...(nextToken ? { NextToken: nextToken } : {}),
        }),
      );
      for (const group of page.Groups ?? []) {
        if (group.GroupName) {
          names.push(group.GroupName);
        }
      }
      nextToken = page.NextToken;
    } while (nextToken);
    return names;
  }

  async getByUsername(username: string): Promise<CognitoAccount | null> {
    try {
      const user = await this.cognito.send(
        new AdminGetUserCommand({
          UserPoolId: this.poolId(),
          Username: username,
        }),
      );
      return toAccount(
        user.Username ?? username,
        user.UserAttributes,
        user.UserStatus,
        user.Enabled,
      );
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        return null;
      }
      throw error;
    }
  }

  async setAttribute(
    username: string,
    name: string,
    value: string,
  ): Promise<void> {
    await this.cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.poolId(),
        Username: username,
        UserAttributes: [{ Name: name, Value: value }],
      }),
    );
  }

  async deleteAttribute(username: string, name: string): Promise<void> {
    await this.cognito.send(
      new AdminDeleteUserAttributesCommand({
        UserPoolId: this.poolId(),
        Username: username,
        UserAttributeNames: [name],
      }),
    );
  }

  async addToGroup(username: string, group: string): Promise<void> {
    await this.cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: this.poolId(),
        Username: username,
        GroupName: group,
      }),
    );
  }

  /**
   * Removing a user who is not in the group is a no-op. A user deleted
   * between the list and this call is logged and skipped.
   */
  async removeFromGroup(username: string, group: string): Promise<void> {
    try {
      await this.cognito.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: this.poolId(),
          Username: username,
          GroupName: group,
        }),
      );
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (
        name === 'UserNotFoundException' ||
        name === 'ResourceNotFoundException'
      ) {
        this.logger.warn(`Skipped removing ${username} from ${group}: ${name}`);
        return;
      }
      throw error;
    }
  }

  private async listUsers(filter?: string): Promise<CognitoAccount[]> {
    const accounts: CognitoAccount[] = [];
    let paginationToken: string | undefined;
    do {
      const page = await this.cognito.send(
        new ListUsersCommand({
          UserPoolId: this.poolId(),
          Limit: PAGE_SIZE,
          ...(filter ? { Filter: filter } : {}),
          ...(paginationToken ? { PaginationToken: paginationToken } : {}),
        }),
      );
      for (const user of page.Users ?? []) {
        const account = fromListedUser(user);
        if (account) {
          accounts.push(account);
        }
      }
      paginationToken = page.PaginationToken;
    } while (paginationToken);
    return accounts;
  }

  private poolId(): string {
    const poolId = this.config.userPoolId();
    if (poolId === '') {
      throw new ServiceUnavailableException(
        'Cognito user pool is not configured.',
      );
    }
    return poolId;
  }
}

function fromListedUser(user: UserType): CognitoAccount | null {
  if (!user.Username) {
    return null;
  }
  return toAccount(
    user.Username,
    user.Attributes,
    user.UserStatus,
    user.Enabled,
  );
}

function toAccount(
  username: string,
  attributes: AttributeType[] | undefined,
  userStatus: string | undefined,
  enabled: boolean | undefined,
): CognitoAccount | null {
  const sub = attributeValue(attributes, 'sub');
  if (!sub) {
    return null;
  }
  return {
    username,
    sub,
    email: attributeValue(attributes, 'email'),
    name: attributeValue(attributes, 'name'),
    signatoryId: attributeValue(attributes, SIGNATORY_ATTRIBUTE),
    organizationId: attributeValue(attributes, ORGANIZATION_ATTRIBUTE),
    status: enabled === false ? 'DISABLED' : (userStatus ?? null),
  };
}

function attributeValue(
  attributes: AttributeType[] | undefined,
  name: string,
): string | null {
  const value = attributes?.find((attribute) => attribute.Name === name)?.Value;
  return value && value !== '' ? value : null;
}
