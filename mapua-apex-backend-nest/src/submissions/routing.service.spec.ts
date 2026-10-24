import { describe, expect, it } from 'vitest';
import type { Item } from '../common/records.js';
import { RoutingService } from './routing.service.js';

describe('RoutingService', () => {
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
      return role === 'osaar' ? 'osaar-1' : null;
    },
  };
  const routing = new RoutingService(
    organizations as never,
    signatories as never,
  );

  it('skips the dean desk for a higher council and stops before an unconfigured CDM desk', async () => {
    await expect(
      routing.sequenceFor('council', [], 'co-curricular', false),
    ).resolves.toEqual(['council-adviser', 'osaar-1']);
  });

  it('rejects a missing collaborator before writing', async () => {
    await expect(
      routing.sequenceFor('council', ['missing'], 'extra-curricular', false),
    ).rejects.toMatchObject({
      response: { message: 'The selected organization does not exist.' },
    });
  });

  it('rejects a reservation when no CDM signatory is configured', async () => {
    await expect(
      routing.sequenceFor('council', [], 'extra-curricular', true),
    ).rejects.toMatchObject({
      response: { message: 'No cdm signatory is configured.' },
    });
  });
});
