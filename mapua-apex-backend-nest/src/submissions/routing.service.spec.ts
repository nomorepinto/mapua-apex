import { describe, expect, it } from 'vitest';
import type { Item } from '../common/records.js';
import { RoutingService, type SignatoryStep } from './routing.service.js';

describe('RoutingService', () => {
  let cdmId: string | null = null;
  const osaarPeople: Item[] = [
    {
      PK: 'SIGNATORY#osaar-1',
      role: 'osaar',
      campus_id: 'intramuros',
      osaar_order: 1,
    },
    {
      PK: 'SIGNATORY#osaar-all',
      role: 'osaar',
      all_campuses: true,
    },
  ];
  const campusItems = new Map<string, Item>([
    ['intramuros', { PK: 'CAMPUS#intramuros', name: 'Intramuros', main: true }],
    ['makati', { PK: 'CAMPUS#makati', name: 'Makati' }],
  ]);
  const organizations = {
    async get(id: string): Promise<Item | undefined> {
      if (id === 'missing') {
        return undefined;
      }
      return {
        PK: `ORGANIZATION#${id}`,
        SK: `ORGANIZATION#${id}`,
        name: id === 'council' ? 'Council' : 'Society',
        skip_dean: id === 'council',
        skip_post_eval: false,
        signatories: [{ role: 'adviser', signatory_id: `${id}-adviser` }],
      };
    },
  };
  const signatories = {
    async findIdByRole(role: string): Promise<string | null> {
      return role === 'cdm' ? cdmId : null;
    },
    async listByRole(role: string): Promise<Item[]> {
      return role === 'osaar' ? osaarPeople : [];
    },
    async get(id: string): Promise<Item | undefined> {
      if (
        id === 'osaar-1' ||
        id === 'osaar-2' ||
        id === 'legacy-osaar' ||
        id === 'osaar-all'
      ) {
        return { role: 'osaar', name: id };
      }
      if (id.endsWith('-adviser')) {
        return { role: 'adviser', name: id };
      }
      return undefined;
    },
  };
  const campuses = {
    async get(id: string): Promise<Item | undefined> {
      return campusItems.get(id);
    },
    async list(): Promise<Item[]> {
      return [...campusItems.values()];
    },
  };
  const routing = new RoutingService(
    organizations as never,
    signatories as never,
    campuses as never,
  );

  function ids(steps: SignatoryStep[]): string[] {
    return steps.map((step) => step.signatory_id);
  }

  it('skips the dean desk when skip_dean is set and stops before an unconfigured CDM desk', async () => {
    cdmId = null;
    await expect(
      routing.sequenceFor(
        'council',
        [],
        'co-curricular',
        false,
        undefined,
        'intramuros',
      ),
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
      {
        key: 'osaar_all',
        role: 'osaar',
        signatory_id: 'osaar-all',
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
      routing.sequenceFor(
        'council',
        [],
        'extra-curricular',
        true,
        undefined,
        'intramuros',
      ),
    ).rejects.toMatchObject({
      response: { message: 'No cdm signatory is configured.' },
    });
  });

  it('appends the campus OSAARs, then the all-campus OSAAR, before CDM', async () => {
    const added: Item = {
      PK: 'SIGNATORY#osaar-2',
      role: 'osaar',
      campus_id: 'intramuros',
      osaar_order: 2,
    };
    osaarPeople.splice(1, 0, added);
    cdmId = 'cdm-1';
    try {
      const steps = await routing.sequenceFor(
        'society',
        [],
        'extra-curricular',
        true,
        undefined,
        'intramuros',
      );
      expect(steps.map((step) => step.key)).toEqual([
        'adviser:ORG#society',
        'osaar_1',
        'osaar_2',
        'osaar_all',
        'cdm',
      ]);
      expect(ids(steps)).toEqual([
        'society-adviser',
        'osaar-1',
        'osaar-2',
        'osaar-all',
        'cdm-1',
      ]);
    } finally {
      osaarPeople.splice(osaarPeople.indexOf(added), 1);
    }
  });

  it('routes an online plan through the main campus', async () => {
    await expect(
      routing.hostCampusId({ venue: 'Online', reservationCampusIds: [] }),
    ).resolves.toBe('intramuros');
  });

  it('uses the supplied OSAAR stages instead of the current campus', async () => {
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
