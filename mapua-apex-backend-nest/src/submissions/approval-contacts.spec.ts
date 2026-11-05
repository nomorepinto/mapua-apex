import { describe, expect, it } from 'vitest';
import type { Item } from '../common/records.js';
import { approvalChainContacts } from './approval-contacts.js';

const chain: Item[] = [
  {
    signatory_id: 'adviser-1',
    role: 'adviser',
    organization_id: 'org-1',
    organization_name: 'Society',
    stage_key: 'adviser',
  },
  {
    signatory_id: 'dean-1',
    role: 'dean',
    organization_id: null,
    organization_name: null,
    stage_key: 'dean',
  },
  {
    signatory_id: 'cdm-1',
    role: 'cdm',
    organization_id: null,
    organization_name: null,
    stage_key: 'cdm',
  },
  {
    signatory_id: 'osaar-1',
    role: 'osaar',
    organization_id: null,
    organization_name: null,
    stage_key: 'osaar',
  },
];

const people: Item[] = [
  {
    PK: 'SIGNATORY#adviser-1',
    SK: 'SIGNATORY#adviser-1',
    name: 'Ana Reyes',
    role: 'adviser',
    contact_email: 'ana.reyes@example.test',
    office: 'Room 204',
    contact_number: '+63 2 8888 0001',
  },
  { PK: 'SIGNATORY#dean-1', SK: 'SIGNATORY#dean-1', name: 'Ben Cruz', role: 'dean' },
  { PK: 'SIGNATORY#cdm-1', SK: 'SIGNATORY#cdm-1', name: 'Carla Diaz', role: 'cdm' },
  {
    PK: 'SIGNATORY#osaar-1',
    SK: 'SIGNATORY#osaar-1',
    name: 'Dino Pascual',
    role: 'osaar',
    office: 'YC Building',
  },
];

describe('approvalChainContacts', () => {
  it('starts an open paper at the desk it sits on and marks that desk current', () => {
    const contacts = approvalChainContacts({
      chain,
      people,
      status: 'pending',
      currentSignatoryId: 'SIGNATORY#cdm-1',
    });

    expect(contacts.map((contact) => contact.signatory_id)).toEqual([
      'cdm-1',
      'osaar-1',
    ]);
    expect(contacts[0]?.is_current).toBe(true);
    expect(contacts[1]?.is_current).toBe(false);
  });

  it('carries the desk contact details, and nulls where nothing is on file', () => {
    const contacts = approvalChainContacts({
      chain,
      people,
      status: 'pending',
      currentSignatoryId: 'cdm-1',
    });

    expect(contacts[0]).toEqual({
      signatory_id: 'cdm-1',
      name: 'Carla Diaz',
      role: 'cdm',
      organization_name: null,
      contact_email: null,
      office: null,
      contact_number: null,
      is_current: true,
    });
    expect(contacts[1]?.office).toBe('YC Building');
  });

  it('keeps the organization name from the chain link', () => {
    const [first] = approvalChainContacts({
      chain,
      people,
      status: 'returned',
      currentSignatoryId: 'adviser-1',
    });

    expect(first?.organization_name).toBe('Society');
    expect(first?.contact_email).toBe('ana.reyes@example.test');
    expect(first?.contact_number).toBe('+63 2 8888 0001');
  });

  it('treats a returned paper as still on a desk', () => {
    const contacts = approvalChainContacts({
      chain,
      people,
      status: 'returned',
      currentSignatoryId: 'dean-1',
    });

    expect(contacts.map((contact) => contact.signatory_id)).toEqual([
      'dean-1',
      'cdm-1',
      'osaar-1',
    ]);
  });

  it('falls back to the OSAAR desk once the paper is decided', () => {
    for (const status of ['approved', 'finished', 'denied', 'cancelled']) {
      const contacts = approvalChainContacts({
        chain,
        people,
        status,
        currentSignatoryId: 'osaar-1',
      });
      expect(contacts.map((contact) => contact.signatory_id)).toEqual([
        'osaar-1',
      ]);
      expect(contacts[0]?.is_current).toBe(true);
    }
  });

  it('keeps the whole chain when a decided paper has no OSAAR desk', () => {
    const contacts = approvalChainContacts({
      chain: chain.slice(0, 2),
      people,
      status: 'denied',
      currentSignatoryId: null,
    });

    expect(contacts.map((contact) => contact.signatory_id)).toEqual([
      'adviser-1',
      'dean-1',
    ]);
    expect(contacts.every((contact) => !contact.is_current)).toBe(true);
  });

  it('keeps the whole chain when the current desk is not in it', () => {
    const contacts = approvalChainContacts({
      chain,
      people,
      status: 'pending',
      currentSignatoryId: 'someone-else',
    });

    expect(contacts).toHaveLength(4);
    expect(contacts.every((contact) => !contact.is_current)).toBe(true);
  });

  it('renders a desk whose signatory row is missing with blanks', () => {
    const contacts = approvalChainContacts({
      chain,
      people: [],
      status: 'pending',
      currentSignatoryId: 'cdm-1',
    });

    expect(contacts[0]?.name).toBe('');
    expect(contacts[0]?.role).toBe('cdm');
    expect(contacts[0]?.contact_email).toBeNull();
  });

  it('drops chain links without a signatory id', () => {
    const contacts = approvalChainContacts({
      chain: [...chain, { role: 'dean', signatory_id: '' }],
      people,
      status: 'pending',
      currentSignatoryId: 'cdm-1',
    });

    expect(contacts).toHaveLength(2);
  });
});
