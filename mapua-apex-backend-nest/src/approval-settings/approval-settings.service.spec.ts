import { describe, expect, it } from 'vitest';
import type { Item } from '../common/records.js';
import { ApprovalSettingsService } from './approval-settings.service.js';
import type { StoredOsaarStage } from './approval-settings.repository.js';

describe('ApprovalSettingsService', () => {
  let stored: Item | undefined;
  let saved: StoredOsaarStage[] | undefined;
  const people = new Map<string, Item>([
    ['osaar-1', { PK: 'SIGNATORY#osaar-1', name: 'Sir Kyle', role: 'osaar' }],
    ['osaar-2', { PK: 'SIGNATORY#osaar-2', name: 'Maam Grace', role: 'osaar' }],
    ['dean-1', { PK: 'SIGNATORY#dean-1', name: 'Dean', role: 'dean' }],
  ]);
  let roleIds = ['osaar-1'];

  const settings = {
    async get(): Promise<Item | undefined> {
      return stored;
    },
    async save(stages: StoredOsaarStage[]): Promise<Item> {
      saved = stages;
      stored = {
        PK: 'SETTINGS#APPROVAL',
        SK: 'SETTINGS#APPROVAL',
        osaar_stages: stages,
      };
      return stored;
    },
  };
  const signatories = {
    async get(id: string): Promise<Item | undefined> {
      return people.get(id);
    },
    async listIdsByRole(role: string): Promise<string[]> {
      return role === 'osaar' ? roleIds : [];
    },
  };
  const service = new ApprovalSettingsService(
    settings as never,
    signatories as never,
  );

  it('falls back to the single OSAAR signatory when nothing is saved', async () => {
    stored = undefined;
    roleIds = ['osaar-1'];
    await expect(service.view()).resolves.toEqual({
      osaar_stages: [
        {
          key: 'osaar_1',
          order: 1,
          signatory_id: 'osaar-1',
          signatory_name: 'Sir Kyle',
        },
      ],
    });
    await expect(service.osaarStageIds()).resolves.toEqual(['osaar-1']);
  });

  it('returns no stages when several OSAAR accounts exist and nothing is saved', async () => {
    stored = undefined;
    roleIds = ['osaar-1', 'osaar-2'];
    await expect(service.view()).resolves.toEqual({ osaar_stages: [] });
    await expect(service.osaarStageIds()).rejects.toMatchObject({
      response: {
        message:
          'More than one OSAAR signatory exists. Configure OSAAR approval stages before sending a proposal.',
      },
    });
  });

  it('rejects a stage that is not an OSAAR signatory', async () => {
    await expect(service.replace(['osaar-1', 'dean-1'])).rejects.toMatchObject({
      response: {
        message: 'Each OSAAR stage must be an existing OSAAR signatory.',
      },
    });
  });

  it('rejects a repeated signatory', async () => {
    await expect(service.replace(['osaar-1', 'osaar-1'])).rejects.toMatchObject(
      {
        response: {
          message: 'Each OSAAR stage must be a different signatory.',
        },
      },
    );
  });

  it('saves ordered stages and serves them to new submissions', async () => {
    stored = undefined;
    saved = undefined;
    await expect(service.replace(['osaar-2', 'osaar-1'])).resolves.toEqual({
      osaar_stages: [
        {
          key: 'osaar_1',
          order: 1,
          signatory_id: 'osaar-2',
          signatory_name: 'Maam Grace',
        },
        {
          key: 'osaar_2',
          order: 2,
          signatory_id: 'osaar-1',
          signatory_name: 'Sir Kyle',
        },
      ],
    });
    expect(saved).toEqual([
      { key: 'osaar_1', signatory_id: 'SIGNATORY#osaar-2' },
      { key: 'osaar_2', signatory_id: 'SIGNATORY#osaar-1' },
    ]);
    await expect(service.osaarStageIds()).resolves.toEqual([
      'osaar-2',
      'osaar-1',
    ]);
  });

  it('rejects a saved stage whose signatory is no longer OSAAR', async () => {
    stored = {
      osaar_stages: [{ key: 'osaar_1', signatory_id: 'SIGNATORY#dean-1' }],
    };
    await expect(service.osaarStageIds()).rejects.toMatchObject({
      response: {
        message:
          'An OSAAR approval stage points at a signatory that is no longer an OSAAR account.',
      },
    });
  });
});
