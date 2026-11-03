import { describe, expect, it } from 'vitest';
import type { Item } from '../common/records.js';
import { ApprovalSettingsService } from './approval-settings.service.js';

describe('ApprovalSettingsService', () => {
  const campuses = new Map<string, Item>([
    [
      'intramuros',
      {
        PK: 'CAMPUS#intramuros',
        SK: 'CAMPUS#intramuros',
        name: 'Intramuros',
        main: true,
      },
    ],
    ['makati', { PK: 'CAMPUS#makati', SK: 'CAMPUS#makati', name: 'Makati' }],
  ]);
  const people = new Map<string, Item>([
    [
      'osaar-1',
      {
        PK: 'SIGNATORY#osaar-1',
        name: 'Sir Kyle',
        role: 'osaar',
        campus_id: 'intramuros',
        osaar_order: 1,
      },
    ],
    [
      'osaar-2',
      {
        PK: 'SIGNATORY#osaar-2',
        name: 'Maam Grace',
        role: 'osaar',
        campus_id: 'intramuros',
        osaar_order: 2,
      },
    ],
    [
      'osaar-all',
      {
        PK: 'SIGNATORY#osaar-all',
        name: 'All Campus',
        role: 'osaar',
        all_campuses: true,
      },
    ],
  ]);
  const orders: { id: string; order: number }[] = [];

  const signatories = {
    async listByRole(role: string): Promise<Item[]> {
      return role === 'osaar' ? [...people.values()] : [];
    },
    async setOsaarOrder(id: string, order: number): Promise<void> {
      orders.push({ id, order });
      const person = people.get(id);
      if (person) {
        person.osaar_order = order;
      }
    },
  };
  const campusRepo = {
    async list(): Promise<Item[]> {
      return [...campuses.values()];
    },
    async get(id: string): Promise<Item | undefined> {
      return campuses.get(id);
    },
  };
  const service = new ApprovalSettingsService(
    signatories as never,
    campusRepo as never,
  );

  it('groups OSAAR accounts by campus and names the all-campus account', async () => {
    await expect(service.view()).resolves.toMatchObject({
      all_campus_signatory: {
        signatory_id: 'osaar-all',
        signatory_name: 'All Campus',
      },
      unassigned: [],
      campuses: [
        {
          campus_id: 'intramuros',
          campus_name: 'Intramuros',
          osaar_stages: [
            { order: 1, signatory_id: 'osaar-1', campus_name: 'Intramuros' },
            { order: 2, signatory_id: 'osaar-2', campus_name: 'Intramuros' },
          ],
        },
        { campus_id: 'makati', campus_name: 'Makati', osaar_stages: [] },
      ],
    });
  });

  it('rejects a list that is not exactly the campus OSAAR accounts', async () => {
    await expect(
      service.replace('intramuros', ['osaar-1']),
    ).rejects.toMatchObject({
      response: {
        message:
          'OSAAR approval stages must list each OSAAR assigned to this campus.',
      },
    });
  });

  it('rewrites the saved order for one campus', async () => {
    orders.length = 0;
    const view = await service.replace('intramuros', ['osaar-2', 'osaar-1']);
    expect(orders).toEqual([
      { id: 'osaar-2', order: 1 },
      { id: 'osaar-1', order: 2 },
    ]);
    const group = view.campuses.find(
      (campus) => campus.campus_id === 'intramuros',
    );
    expect(group?.osaar_stages.map((stage) => stage.signatory_id)).toEqual([
      'osaar-2',
      'osaar-1',
    ]);
  });
});
