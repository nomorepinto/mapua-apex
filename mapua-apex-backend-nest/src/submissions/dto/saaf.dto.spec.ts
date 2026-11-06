import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaafDto } from './saaf.dto.js';

/** Minimal SAAF body; each test overrides the budget section it cares about. */
const bodyWith = (detailedBudgetProposal: unknown): Item => ({
  submission_type: 'saaf',
  activity_classification: {
    activity_type: 'co-curricular',
    total_org_members: 10,
  },
  proponents: [
    {
      first_name: 'Ana',
      last_name: 'Mendoza',
      position_of_applicant: 'President',
      department: 'CAS',
      contact_number: '09171234567',
      email_address: 'ana.mendoza@mymail.mapua.edu.ph',
    },
  ],
  activity_details: {
    title_and_nature: 'Week of Welcome',
    description: 'A campus-wide orientation week.',
    objectives: 'Students learn about student organizations.',
    venue: 'MAIN',
    date_of_event: '2026-10-01',
    time_of_event: '09:00 AM to 12:00 NN',
    expected_participants: 100,
    individual_contribution: 0,
    proposed_budget: 0,
  },
  institutional_alignment: {
    mission_statements: {
      competitive: true,
      research: false,
      solutions: false,
    },
    core_values_explanation: 'Service and excellence.',
    sdg_explanation: 'Quality education.',
  },
  detailed_budget_proposal: detailedBudgetProposal,
  venue_reservation: { has_reservation: false },
});

type Item = Record<string, unknown>;

function issues(detailedBudgetProposal: unknown): string[] {
  const instance = plainToInstance(SaafDto, bodyWith(detailedBudgetProposal), {
    exposeUnsetFields: false,
  });
  const found: string[] = [];
  const walk = (
    errors: ReturnType<typeof validateSync>,
    path: string,
  ): void => {
    for (const error of errors) {
      const key = path ? `${path}.${error.property}` : error.property;
      if (error.constraints)
        found.push(`${key}: ${JSON.stringify(error.constraints)}`);
      if (error.children?.length) walk(error.children, key);
    }
  };
  walk(validateSync(instance, { whitelist: true }), '');
  return found;
}

describe('SaafDto budget validation', () => {
  it('accepts a no-budget proposal with empty lines and zero totals', () => {
    expect(issues({ has_budget: false, items: [], grand_total: 0 })).toEqual(
      [],
    );
  });

  it('accepts a no-budget proposal without the legacy-required non-empty items', () => {
    expect(issues({ has_budget: false })).toEqual([]);
  });

  it('still accepts a with-budget proposal shaped like the old payload', () => {
    expect(
      issues({
        has_budget: true,
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('keeps validating line items when a budget is present', () => {
    const found = issues({
      has_budget: true,
      items: [{ item_no: '1', unit: 'way too many units', quantity: 2 }],
      grand_total: 100,
    });
    expect(found.join('\n')).toContain('detailed_budget_proposal.items');
  });

  it('still validates a legacy proposal that carries no has_budget key', () => {
    // Missing key means an older paper, which always carried at least one line.
    expect(
      issues({
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('keeps `has_budget: false` through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      SaafDto,
      bodyWith({ has_budget: false, items: [], grand_total: 0 }),
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    const proposal = instance.detailed_budget_proposal as unknown as Item;
    expect(proposal.has_budget).toBe(false);
  });

  it('accepts a with-budget proposal carrying funding sources', () => {
    expect(
      issues({
        has_budget: true,
        funding_sources: ['sponsors', 'organization'],
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('rejects an unknown funding source with the nested error key', () => {
    const found = issues({
      has_budget: true,
      funding_sources: ['investors'],
      items: [
        {
          item_no: '1',
          unit: 'pc',
          quantity: 2,
          price_per_unit: 50,
          total: 100,
        },
      ],
      grand_total: 100,
    });
    expect(found.join('\n')).toContain(
      'detailed_budget_proposal.funding_sources',
    );
  });

  it('keeps `funding_sources` through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      SaafDto,
      bodyWith({
        has_budget: true,
        funding_sources: ['sponsors', 'organization'],
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    const proposal = instance.detailed_budget_proposal as unknown as Item;
    expect(proposal.funding_sources).toEqual(['sponsors', 'organization']);
  });

  it('accepts the newly added funding sources', () => {
    expect(
      issues({
        has_budget: true,
        funding_sources: ['member_contributions', 'others'],
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('accepts a with-budget proposal carrying a budget note', () => {
    expect(
      issues({
        has_budget: true,
        note: 'Sponsorship covers the venue; contributions cover food.',
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
    ).toEqual([]);
  });

  it('rejects a budget note longer than 500 characters', () => {
    const found = issues({
      has_budget: true,
      note: 'a'.repeat(501),
      items: [
        {
          item_no: '1',
          unit: 'pc',
          quantity: 2,
          price_per_unit: 50,
          total: 100,
        },
      ],
      grand_total: 100,
    });
    expect(found.join('\n')).toContain('detailed_budget_proposal.note');
  });

  it('keeps `note` through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      SaafDto,
      bodyWith({
        has_budget: true,
        note: 'Member contributions cover catering.',
        items: [
          {
            item_no: '1',
            unit: 'pc',
            quantity: 2,
            price_per_unit: 50,
            total: 100,
          },
        ],
        grand_total: 100,
      }),
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    const proposal = instance.detailed_budget_proposal as unknown as Item;
    expect(proposal.note).toBe('Member contributions cover catering.');
  });
});
