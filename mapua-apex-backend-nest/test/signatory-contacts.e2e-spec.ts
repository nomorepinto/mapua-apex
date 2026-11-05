import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Item } from '../src/common/records.js';
import { bearer, createTestApp } from './create-app.js';
import type { MemoryDynamo } from './memory-dynamo.js';

const TABLE = process.env.AWS_DYNAMODB_TABLE ?? 'apex-test';
const EVENT = 'ev-1';
const SUBMISSION = 'sub-1';

/** The desk the seeded proposal sits on, so the chain starts at CDM. */
const CURRENT_DESK = 'sig-cdm';

function signatory(id: string, extra: Item = {}): Item {
  const key = `SIGNATORY#${id}`;
  return {
    PK: key,
    SK: key,
    name: id,
    role: 'adviser',
    GSI4PK: `ROLE#adviser`,
    GSI4SK: key,
    ...extra,
  };
}

/**
 * A proposal filed by `org-1` whose frozen chain runs adviser → dean → CDM →
 * OSAAR and which currently sits on the CDM desk.
 */
function submission(): Item {
  const sentAt = '2026-01-05T02:00:00.000Z';
  const steps = [
    { key: 'adviser', role: 'adviser', signatory_id: 'sig-1', organization_id: 'org-1' },
    { key: 'dean', role: 'dean', signatory_id: 'sig-dean', organization_id: null },
    { key: 'cdm', role: 'cdm', signatory_id: 'sig-cdm', organization_id: null },
    { key: 'osaar_1', role: 'osaar', signatory_id: 'sig-osaar', organization_id: null },
  ];
  return {
    PK: `EVENT#${EVENT}`,
    SK: `SUBMISSION#${SUBMISSION}`,
    GSI1PK: 'ORGANIZATION#org-1',
    GSI1SK: `SUBMISSION#${SUBMISSION}`,
    GSI2PK: `SIGNATORY#${CURRENT_DESK}`,
    GSI2SK: sentAt,
    submission_type: 'activity',
    sent_at: sentAt,
    status: 'pending',
    current_signatory: `SIGNATORY#${CURRENT_DESK}`,
    signatory_sequence: steps.map((step) => `SIGNATORY#${step.signatory_id}`),
    signatory_steps: steps.map((step) => ({
      key: step.key,
      role: step.role,
      signatory_id: `SIGNATORY#${step.signatory_id}`,
      organization_id: step.organization_id
        ? `ORGANIZATION#${step.organization_id}`
        : null,
    })),
    collaboration: { dependent_organization_ids: [] },
  };
}

describe('signatory contact details', () => {
  let app: INestApplication;
  let dynamo: MemoryDynamo;

  beforeAll(async () => {
    const started = await createTestApp();
    app = started.app;
    dynamo = started.dynamo;

    await dynamo.put(TABLE, {
      PK: 'ORGANIZATION#org-1',
      SK: 'ORGANIZATION#org-1',
      name: 'Society',
      skip_dean: false,
      skip_post_eval: false,
      signatories: [{ role: 'adviser', signatory_id: 'sig-1' }],
    });
    await dynamo.put(
      TABLE,
      signatory('sig-1', {
        name: 'Ana Reyes',
        role: 'adviser',
        GSI4PK: 'ROLE#adviser',
        contact_email: 'ana.reyes@mapua.edu.ph',
        office: 'Room 204',
        contact_number: '(02) 8888 0001',
      }),
    );
    await dynamo.put(
      TABLE,
      signatory('sig-dean', {
        name: 'Ben Cruz',
        role: 'dean',
        office: "Dean's Front Desk",
      }),
    );
    await dynamo.put(
      TABLE,
      signatory('sig-cdm', { name: 'Carla Diaz', role: 'cdm' }),
    );
    await dynamo.put(
      TABLE,
      signatory('sig-osaar', {
        name: 'Dino Pascual',
        role: 'osaar',
        office: 'OSAAR Front Desk',
      }),
    );
    await dynamo.put(TABLE, submission());
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores the contact details an admin files with a new desk', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v2/admins/signatories')
      .set('Authorization', bearer('admin'))
      .send({
        name: 'Elena Ramos',
        role: 'adviser',
        contact_email: 'elena.ramos@mapua.edu.ph',
        office: '  Room 311  ',
        contact_number: '(02) 8888 0002',
      })
      .expect(201);

    expect(created.body.data.contact_email).toBe('elena.ramos@mapua.edu.ph');
    expect(created.body.data.office).toBe('Room 311');
    expect(created.body.data.contact_number).toBe('(02) 8888 0002');

    const stored = await dynamo.get(TABLE, {
      PK: `SIGNATORY#${created.body.data.signatory_id}`,
      SK: `SIGNATORY#${created.body.data.signatory_id}`,
    });
    expect(stored?.contact_email).toBe('elena.ramos@mapua.edu.ph');
    expect(stored?.office).toBe('Room 311');
  });

  it('leaves a blank contact field off the stored row', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v2/admins/signatories')
      .set('Authorization', bearer('admin'))
      .send({ name: 'Fe Torres', role: 'adviser', office: '   ' })
      .expect(201);

    const stored = await dynamo.get(TABLE, {
      PK: `SIGNATORY#${created.body.data.signatory_id}`,
      SK: `SIGNATORY#${created.body.data.signatory_id}`,
    });
    expect(stored).toBeDefined();
    expect('office' in (stored ?? {})).toBe(false);
    expect(created.body.data.office).toBeNull();
  });

  it('drops a contact detail an admin clears on edit', async () => {
    await request(app.getHttpServer())
      .put('/api/v2/admins/signatories/sig-dean')
      .set('Authorization', bearer('admin'))
      .send({ name: 'Ben Cruz', role: 'dean', office: '' })
      .expect(200);

    const stored = await dynamo.get(TABLE, {
      PK: 'SIGNATORY#sig-dean',
      SK: 'SIGNATORY#sig-dean',
    });
    expect(stored?.name).toBe('Ben Cruz');
    expect('office' in (stored ?? {})).toBe(false);
  });

  it('rejects a contact email that is not an address', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/admins/signatories')
      .set('Authorization', bearer('admin'))
      .send({ name: 'Gil Umali', role: 'adviser', contact_email: 'not-an-email' })
      .expect(422);

    expect(response.body.errors.contact_email).toBeInstanceOf(Array);
  });

  it('gives the proponent the open desks from the current one onward', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/v2/students/events/${EVENT}/submissions/${SUBMISSION}`)
      .set('Authorization', bearer('student'))
      .expect(200);

    const contacts = detail.body.data.approval_chain_contacts as Item[];
    expect(contacts.map((contact) => contact.signatory_id)).toEqual([
      'sig-cdm',
      'sig-osaar',
    ]);
    expect(contacts[0]).toMatchObject({
      name: 'Carla Diaz',
      role: 'cdm',
      office: null,
      is_current: true,
    });
    expect(contacts[1]).toMatchObject({
      name: 'Dino Pascual',
      role: 'osaar',
      organization_name: null,
      office: 'OSAAR Front Desk',
      contact_email: null,
      is_current: false,
    });
  });

  it('keeps the contacts off the student list and the reviewer and admin reads', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v2/students/submissions')
      .set('Authorization', bearer('student'))
      .expect(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    for (const row of list.body.data as Item[]) {
      expect(row.approval_chain_contacts).toBeUndefined();
    }

    const tail = `/events/${EVENT}/submissions/${SUBMISSION}`;
    for (const [prefix, token] of [
      ['/signatories', 'signatory'],
      ['/admins', 'admin'],
    ] as const) {
      const detail = await request(app.getHttpServer())
        .get(`/api/v2${prefix}${tail}`)
        .set('Authorization', bearer(token))
        .expect(200);
      expect(detail.body.data.signatory_chain).toBeDefined();
      expect(detail.body.data.approval_chain_contacts).toBeUndefined();
    }
  });

  it('falls back to the OSAAR desk once the proposal is decided', async () => {
    await dynamo.update({
      table: TABLE,
      key: { PK: `EVENT#${EVENT}`, SK: `SUBMISSION#${SUBMISSION}` },
      set: { status: 'approved' },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v2/students/events/${EVENT}/submissions/${SUBMISSION}`)
      .set('Authorization', bearer('student'))
      .expect(200);

    const contacts = detail.body.data.approval_chain_contacts as Item[];
    expect(contacts.map((contact) => contact.signatory_id)).toEqual([
      'sig-osaar',
    ]);

    await dynamo.update({
      table: TABLE,
      key: { PK: `EVENT#${EVENT}`, SK: `SUBMISSION#${SUBMISSION}` },
      set: { status: 'pending' },
    });
  });
});
