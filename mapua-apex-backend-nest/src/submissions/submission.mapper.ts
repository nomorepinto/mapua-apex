import { stripPrefix } from '../common/dynamo-keys.js';
import { record, str, type Item } from '../common/records.js';

const HIDDEN = new Set([
  'PK',
  'SK',
  'GSI1PK',
  'GSI1SK',
  'GSI2PK',
  'GSI2SK',
  'GSI3PK',
  'GSI3SK',
  'GSI4PK',
  'GSI4SK',
  'GSI5PK',
  'GSI5SK',
  'booking_refs',
  'entity_type',
]);

/** Public submission shape. Prefixes are stripped. Internal keys stay off the wire. */
export function toSubmission(item: Item, extras: Item = {}): Item {
  const view: Item = {};
  for (const [key, value] of Object.entries(item)) {
    if (HIDDEN.has(key)) {
      continue;
    }
    view[key] = value;
  }
  view.event_id = stripPrefix(item.PK, 'EVENT#');
  view.submission_id = stripPrefix(item.SK, 'SUBMISSION#');
  view.organization_id = stripPrefix(item.GSI1PK, 'ORGANIZATION#');
  view.current_signatory = stripPrefix(item.current_signatory, 'SIGNATORY#');
  const sequence = Array.isArray(item.signatory_sequence)
    ? item.signatory_sequence
    : [];
  view.signatory_sequence = sequence.map(
    (id) => stripPrefix(id, 'SIGNATORY#') ?? String(id),
  );
  if (Array.isArray(item.signatory_steps)) {
    view.signatory_steps = publicSteps(item.signatory_steps);
  }
  const collaboration = record(item.collaboration);
  if (collaboration) {
    const ids = Array.isArray(collaboration.dependent_organization_ids)
      ? collaboration.dependent_organization_ids
      : [];
    view.collaboration = {
      dependent_organization_ids: ids.map(
        (id) => stripPrefix(id, 'ORGANIZATION#') ?? String(id),
      ),
    };
  }
  if (extras.signatory_chain) {
    view.signatory_chain = extras.signatory_chain;
  }
  if (extras.role) {
    view.role = extras.role;
  }
  if (extras.organization_name) {
    view.organization_name = extras.organization_name;
  }
  if (extras.notifications) {
    view.notifications = extras.notifications;
  }
  return view;
}

function publicSteps(value: unknown[]): Item[] {
  return value.flatMap((entry) => {
    const step = record(entry);
    if (!step) {
      return [];
    }
    const key = str(step, 'key');
    const signatoryId = stripPrefix(step.signatory_id, 'SIGNATORY#');
    if (!key || !signatoryId) {
      return [];
    }
    const organizationId = step.organization_id;
    return [
      {
        key,
        role: str(step, 'role'),
        signatory_id: signatoryId,
        organization_id:
          typeof organizationId === 'string'
            ? stripPrefix(organizationId, 'ORGANIZATION#')
            : null,
      },
    ];
  });
}

export function toNotification(item: Item): Item {
  return {
    submission_id: stripPrefix(item.PK, 'SUBMISSION#'),
    sent_at: stripPrefix(item.SK, 'NOTIFICATION#'),
    signatory: stripPrefix(item.signatory, 'SIGNATORY#'),
    notif_type: str(item, 'notif_type'),
    comment: str(item, 'comment') ?? '',
  };
}
