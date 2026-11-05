import { stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';

/** Statuses whose paper still sits on a signatory desk. */
const OPEN_STATUSES = new Set(['pending', 'returned']);

/** One desk the proponent may still need to reach, with its contact details. */
export interface ApprovalChainContact {
  signatory_id: string;
  name: string;
  role: string | null;
  organization_name: string | null;
  contact_email: string | null;
  office: string | null;
  contact_number: string | null;
  is_current: boolean;
}

export interface ApprovalChainContactInput {
  /** Ordered chain links from `RoutingService.chain()`. */
  chain: Item[];
  /** Signatory rows for those links, from one `BatchGetItem`. */
  people: Item[];
  status: string | null;
  currentSignatoryId: string | null;
}

/**
 * Desks the proponent may still write to, in approval order.
 *
 * An open paper starts at the desk it sits on now, because the desks it already
 * cleared no longer owe the proponent anything. A decided paper has no open
 * desk, so the OSAAR links stand in: that is who the proponent asks about the
 * outcome. The whole chain is the last resort so the tab is never empty.
 */
export function approvalChainContacts(
  input: ApprovalChainContactInput,
): ApprovalChainContact[] {
  const { chain, people, status, currentSignatoryId } = input;
  const current = bare(currentSignatoryId);
  const links =
    OPEN_STATUSES.has((status ?? '').toLowerCase()) && current
      ? fromCurrentDesk(chain, current)
      : decidedLinks(chain);
  const rows = new Map<string, Item>();
  for (const person of people) {
    const id = stripPrefix(person.PK, 'SIGNATORY#');
    if (id) {
      rows.set(id, person);
    }
  }
  return links.flatMap((link) => {
    const id = bare(link.signatory_id);
    if (!id) {
      return [];
    }
    const person = rows.get(id);
    return [
      {
        signatory_id: id,
        name: person ? (str(person, 'name') ?? '') : '',
        role: str(link, 'role') ?? (person ? str(person, 'role') : null),
        organization_name: str(link, 'organization_name'),
        contact_email: person ? str(person, 'contact_email') : null,
        office: person ? str(person, 'office') : null,
        contact_number: person ? str(person, 'contact_number') : null,
        is_current: id === current,
      },
    ];
  });
}

/** The current desk and every desk after it. An unknown desk keeps the chain. */
function fromCurrentDesk(chain: Item[], current: string): Item[] {
  const index = chain.findIndex((link) => bare(link.signatory_id) === current);
  return index < 0 ? chain : chain.slice(index);
}

function decidedLinks(chain: Item[]): Item[] {
  const osaar = chain.filter((link) => str(link, 'role') === 'osaar');
  return osaar.length > 0 ? osaar : chain;
}

function bare(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return stripPrefix(value, 'SIGNATORY#') ?? value;
}
