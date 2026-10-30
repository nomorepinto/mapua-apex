import {
  AdminAddUserToGroupCommand,
  AdminDeleteUserAttributesCommand,
  AdminGetUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  ListGroupsCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ORGANIZATION_ATTRIBUTE,
  SIGNATORY_ATTRIBUTE,
} from '../src/accounts/account-groups.js';
import { bearer, createTestApp } from './create-app.js';

interface PoolUser {
  username: string;
  sub: string;
  email: string;
  name: string;
  signatoryId: string | null;
  organizationId: string | null;
  groups: Set<string>;
}

const GROUPS = [
  'Dean',
  'ORG_Adviser',
  'CDM_Reviewer',
  'OSAAR',
  'org_submitter',
];

function pool(): {
  users: Map<string, PoolUser>;
  send: (command: unknown) => Promise<unknown>;
} {
  const users = new Map<string, PoolUser>();
  const send = async (command: unknown): Promise<unknown> => {
    if (command instanceof ListGroupsCommand) {
      return { Groups: GROUPS.map((GroupName) => ({ GroupName })) };
    }
    if (command instanceof ListUsersCommand) {
      const filter = command.input.Filter ?? '';
      const matched = [...users.values()].filter((user) => {
        if (filter === '') {
          return true;
        }
        const signatory = filter.match(
          new RegExp(`${SIGNATORY_ATTRIBUTE} = "([^"]*)"`),
        );
        if (signatory) {
          return user.signatoryId === signatory[1];
        }
        const organization = filter.match(
          new RegExp(`${ORGANIZATION_ATTRIBUTE} = "([^"]*)"`),
        );
        return organization ? user.organizationId === organization[1] : false;
      });
      return {
        Users: matched.map((user) => ({
          Username: user.username,
          UserStatus: 'CONFIRMED',
          Enabled: true,
          Attributes: attributesOf(user),
        })),
      };
    }
    if (command instanceof AdminGetUserCommand) {
      const user = users.get(command.input.Username ?? '');
      if (!user) {
        const error = new Error('User does not exist.');
        error.name = 'UserNotFoundException';
        throw error;
      }
      return {
        Username: user.username,
        UserStatus: 'CONFIRMED',
        Enabled: true,
        UserAttributes: attributesOf(user),
      };
    }
    if (command instanceof AdminUpdateUserAttributesCommand) {
      const user = users.get(command.input.Username ?? '');
      const attribute = command.input.UserAttributes?.[0];
      if (user && attribute?.Name === SIGNATORY_ATTRIBUTE) {
        user.signatoryId = attribute.Value ?? null;
      }
      if (user && attribute?.Name === ORGANIZATION_ATTRIBUTE) {
        user.organizationId = attribute.Value ?? null;
      }
      return {};
    }
    if (command instanceof AdminDeleteUserAttributesCommand) {
      const user = users.get(command.input.Username ?? '');
      const name = command.input.UserAttributeNames?.[0];
      if (user && name === SIGNATORY_ATTRIBUTE) {
        user.signatoryId = null;
      }
      if (user && name === ORGANIZATION_ATTRIBUTE) {
        user.organizationId = null;
      }
      return {};
    }
    if (command instanceof AdminAddUserToGroupCommand) {
      users
        .get(command.input.Username ?? '')
        ?.groups.add(command.input.GroupName ?? '');
      return {};
    }
    if (command instanceof AdminRemoveUserFromGroupCommand) {
      users
        .get(command.input.Username ?? '')
        ?.groups.delete(command.input.GroupName ?? '');
      return {};
    }
    return {};
  };
  return { users, send };
}

function attributesOf(user: PoolUser): { Name: string; Value: string }[] {
  return [
    { Name: 'sub', Value: user.sub },
    { Name: 'email', Value: user.email },
    { Name: 'name', Value: user.name },
    ...(user.signatoryId
      ? [{ Name: SIGNATORY_ATTRIBUTE, Value: user.signatoryId }]
      : []),
    ...(user.organizationId
      ? [{ Name: ORGANIZATION_ATTRIBUTE, Value: user.organizationId }]
      : []),
  ];
}

describe('Cognito account assignment', () => {
  let app: INestApplication;
  const directory = pool();

  beforeAll(async () => {
    directory.users.set('ada@mapua.edu.ph', {
      username: 'ada@mapua.edu.ph',
      sub: 'ada-sub',
      email: 'ada@mapua.edu.ph',
      name: 'Ada Lovelace',
      signatoryId: null,
      organizationId: 'org-1',
      groups: new Set(['org_submitter']),
    });
    directory.users.set('admin@mapua.edu.ph', {
      username: 'admin@mapua.edu.ph',
      sub: 'admin-sub',
      email: 'admin@mapua.edu.ph',
      name: 'Admin Example',
      signatoryId: null,
      organizationId: null,
      groups: new Set(['admin']),
    });
    const started = await createTestApp({ cognitoSend: directory.send });
    app = started.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists accounts for an admin and rejects a student', async () => {
    const listed = await request(app.getHttpServer())
      .get('/api/v2/admins/accounts')
      .set('Authorization', bearer('admin'))
      .expect(200);
    expect(listed.body.data).toEqual([
      expect.objectContaining({
        username: 'ada@mapua.edu.ph',
        name: 'Ada Lovelace',
        organization_id: 'org-1',
        signatory_id: null,
      }),
      expect.objectContaining({ username: 'admin@mapua.edu.ph' }),
    ]);
    await request(app.getHttpServer())
      .get('/api/v2/admins/accounts')
      .set('Authorization', bearer('student'))
      .expect(401);
  });

  it('assigns a signatory account, replaces the holder, then clears it', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v2/admins/signatories')
      .set('Authorization', bearer('admin'))
      .send({ name: 'Dean Cruz', role: 'dean', department: 'IT' })
      .expect(201);
    const signatoryId = created.body.data.signatory_id as string;

    await request(app.getHttpServer())
      .put(`/api/v2/admins/signatories/${signatoryId}/account`)
      .set('Authorization', bearer('admin'))
      .send({})
      .expect(422);

    await request(app.getHttpServer())
      .put('/api/v2/admins/signatories/missing-signatory/account')
      .set('Authorization', bearer('admin'))
      .send({ username: 'ada@mapua.edu.ph' })
      .expect(404);

    const assigned = await request(app.getHttpServer())
      .put(`/api/v2/admins/signatories/${signatoryId}/account`)
      .set('Authorization', bearer('admin'))
      .send({ username: 'ada@mapua.edu.ph' })
      .expect(200);
    expect(assigned.body.data).toMatchObject({
      username: 'ada@mapua.edu.ph',
      signatory_id: signatoryId,
      organization_id: null,
    });
    expect(directory.users.get('ada@mapua.edu.ph')?.groups.has('Dean')).toBe(
      true,
    );
    expect(
      directory.users.get('ada@mapua.edu.ph')?.groups.has('org_submitter'),
    ).toBe(false);

    await request(app.getHttpServer())
      .put(`/api/v2/admins/signatories/${signatoryId}/account`)
      .set('Authorization', bearer('admin'))
      .send({ username: 'admin@mapua.edu.ph' })
      .expect(422);

    directory.users.set('grace@mapua.edu.ph', {
      username: 'grace@mapua.edu.ph',
      sub: 'grace-sub',
      email: 'grace@mapua.edu.ph',
      name: 'Grace Hopper',
      signatoryId: null,
      organizationId: null,
      groups: new Set(['org_submitter']),
    });
    await request(app.getHttpServer())
      .put(`/api/v2/admins/signatories/${signatoryId}/account`)
      .set('Authorization', bearer('admin'))
      .send({ username: 'grace@mapua.edu.ph' })
      .expect(200);
    expect(directory.users.get('ada@mapua.edu.ph')?.signatoryId).toBeNull();
    expect(directory.users.get('ada@mapua.edu.ph')?.groups.has('Dean')).toBe(
      false,
    );
    expect(directory.users.get('grace@mapua.edu.ph')?.signatoryId).toBe(
      signatoryId,
    );

    const cleared = await request(app.getHttpServer())
      .put(`/api/v2/admins/signatories/${signatoryId}/account`)
      .set('Authorization', bearer('admin'))
      .send({ username: null })
      .expect(200);
    expect(cleared.body).toEqual({ data: null });
    expect(directory.users.get('grace@mapua.edu.ph')?.signatoryId).toBeNull();
  });

  it('assigns an organization account', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v2/admins/organizations')
      .set('Authorization', bearer('admin'))
      .send({ name: 'Robotics', signatories: [] })
      .expect(201);
    const organizationId = created.body.data.organization_id as string;
    const assigned = await request(app.getHttpServer())
      .put(`/api/v2/admins/organizations/${organizationId}/account`)
      .set('Authorization', bearer('admin'))
      .send({ username: 'ada@mapua.edu.ph' })
      .expect(200);
    expect(assigned.body.data).toMatchObject({
      username: 'ada@mapua.edu.ph',
      organization_id: organizationId,
      signatory_id: null,
    });
    expect(
      directory.users.get('ada@mapua.edu.ph')?.groups.has('org_submitter'),
    ).toBe(true);
  });
});
