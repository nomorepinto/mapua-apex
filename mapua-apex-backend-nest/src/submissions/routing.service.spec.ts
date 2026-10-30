import { describe, expect, it } from 'vitest';
import type { Item } from '../common/records.js';
import { RoutingService, type SignatoryStep } from './routing.service.js';

describe('RoutingService', () => {
  let osaarIds = ['osaar-1'];
  let cdmId: string | null = null;
  const organizations = {
    async get(id: string): Promise<Item | undefined> {
      if (id === 'missing') {
        return undefined;
      }
      return {
        PK: `ORGANIZATION#${id}`,
        SK: `ORGANIZATION#${id}`,
        name: id === 'council' ? 'Council' : 'Society',
        is_higher_council: id === 'council',
        signatories: [{ role: 'adviser', signatory_id: `${id}-adviser` }],
      };
    },
  };
  const signatories = {
    async findIdByRole(role: string): Promise<string | null> {
      return role === 'cdm' ? cdmId : null;
    },
    async get(id: string): Promise<Item | undefined> {
      if (id === 'osaar-1' || id === 'legacy-osaar') {
        return { role: 'osaar', name: id };
      }
      if (id.endsWith('-adviser')) {
        return { role: 'adviser', name: id };
      }
      return undefined;
    },
  };
  const approvalSettings = {
    async osaarStageIds(): Promise<string[]> {
      return osaarIds;
    },
  };
  const routing = new RoutingService(
    organizations as never,
    signatories as never,
    approvalSettings as never,
  );

  function ids(steps: SignatoryStep[]): string[] {
    return steps.map((step) => step.signatory_id);
  }

  it('skips the dean desk for a higher council and stops before an unconfigured CDM desk', async () => {
    osaarIds = ['osaar-1'];
    cdmId = null;
    await expect(
      routing.sequenceFor('council', [], 'co-curricular', false),
    ).resolves.toMatchObject([
      {
        key: 'adviser:ORG#council',
        role: 'adviser',
        signatory_id: 'council-adviser',
        organization_id: 'council',
      },
      {
        key: 'osaar_1',
        role: 'osaar',
        signatory_id: 'osaar-1',
        organization_id: null,
      },
    ]);
  });

  it('rejects a missing collaborator before writing', async () => {
    await expect(
      routing.sequenceFor('council', ['missing'], 'extra-curricular', false),
    ).rejects.toMatchObject({
      response: { message: 'The selected organization does not exist.' },
    });
  });

  it('rejects a reservation when no CDM signatory is configured', async () => {
    cdmId = null;
    await expect(
      routing.sequenceFor('council', [], 'extra-curricular', true),
    ).rejects.toMatchObject({
      response: { message: 'No cdm signatory is configured.' },
    });
  });

  it('appends every configured OSAAR stage before CDM', async () => {
    osaarIds = ['osaar-1', 'osaar-2'];
    cdmId = 'cdm-1';
    const steps = await routing.sequenceFor(
      'society',
      [],
      'extra-curricular',
      true,
    );
    expect(steps.map((step) => step.key)).toEqual([
      'adviser:ORG#society',
      'osaar_1',
      'osaar_2',
      'cdm',
    ]);
    expect(ids(steps)).toEqual([
      'society-adviser',
      'osaar-1',
      'osaar-2',
      'cdm-1',
    ]);
  });

  it('uses the supplied OSAAR stages instead of the current settings', async () => {
    osaarIds = ['new-osaar'];
    const steps = await routing.sequenceFor(
      'society',
      [],
      'extra-curricular',
      false,
      ['old-osaar-1', 'old-osaar-2'],
    );
    expect(
      steps
        .filter((step) => step.role === 'osaar')
        .map((step) => step.signatory_id),
    ).toEqual(['old-osaar-1', 'old-osaar-2']);
  });

  it('keeps OSAAR ids from stored steps when a submission is edited', async () => {
    await expect(
      routing.frozenOsaarStageIds({
        signatory_steps: [
          {
            key: 'adviser:ORG#society',
            role: 'adviser',
            signatory_id: 'SIGNATORY#society-adviser',
            organization_id: 'ORGANIZATION#society',
          },
          {
            key: 'osaar_1',
            role: 'osaar',
            signatory_id: 'SIGNATORY#old-osaar-1',
            organization_id: null,
          },
          {
            key: 'osaar_2',
            role: 'osaar',
            signatory_id: 'SIGNATORY#old-osaar-2',
            organization_id: null,
          },
        ],
      }),
    ).resolves.toEqual(['old-osaar-1', 'old-osaar-2']);
  });

  it('reads OSAAR ids from a legacy sequence by signatory role', async () => {
    await expect(
      routing.frozenOsaarStageIds({
        signatory_sequence: [
          'SIGNATORY#society-adviser',
          'SIGNATORY#legacy-osaar',
        ],
      }),
    ).resolves.toEqual(['legacy-osaar']);
  });

  it('labels a stored chain with stage keys', async () => {
    await expect(
      routing.chain({
        GSI1PK: 'ORGANIZATION#society',
        signatory_sequence: [
          'SIGNATORY#society-adviser',
          'SIGNATORY#osaar-1',
          'SIGNATORY#osaar-2',
        ],
        signatory_steps: [
          {
            key: 'adviser:ORG#society',
            role: 'adviser',
            signatory_id: 'SIGNATORY#society-adviser',
            organization_id: 'ORGANIZATION#society',
          },
          {
            key: 'osaar_1',
            role: 'osaar',
            signatory_id: 'SIGNATORY#osaar-1',
            organization_id: null,
          },
          {
            key: 'osaar_2',
            role: 'osaar',
            signatory_id: 'SIGNATORY#osaar-2',
            organization_id: null,
          },
        ],
      }),
    ).resolves.toEqual([
      {
        signatory_id: 'society-adviser',
        role: 'adviser',
        organization_id: 'society',
        organization_name: 'Society',
        stage_key: 'adviser:ORG#society',
      },
      {
        signatory_id: 'osaar-1',
        role: 'osaar',
        organization_id: null,
        organization_name: null,
        stage_key: 'osaar_1',
      },
      {
        signatory_id: 'osaar-2',
        role: 'osaar',
        organization_id: null,
        organization_name: null,
        stage_key: 'osaar_2',
      },
    ]);
  });

  it('leaves stage_key empty when the submission has no stored steps', async () => {
    const chain = await routing.chain({
      GSI1PK: 'ORGANIZATION#council',
      signatory_sequence: ['SIGNATORY#council-adviser', 'SIGNATORY#osaar-1'],
    });
    expect(chain[1]).toMatchObject({
      signatory_id: 'osaar-1',
      role: 'osaar',
      stage_key: null,
    });
  });
});
