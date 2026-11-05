import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import {
  cancelWatchKey,
  collaborationKey,
  eventKey,
  notificationKey,
  organizationKey,
  signatoryKey,
  submissionKey,
} from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';

@Injectable()
export class SubmissionRepository {
  constructor(private readonly table: DynamoTable) {}

  getEvent(eventId: string): Promise<Item | undefined> {
    const key = eventKey(eventId);
    return this.table.get(key, key);
  }

  putEvent(item: Item): Promise<void> {
    return this.table.put(item);
  }

  getSubmission(
    eventId: string,
    submissionId: string,
  ): Promise<Item | undefined> {
    return this.table.get(eventKey(eventId), submissionKey(submissionId));
  }

  batchSubmissions(
    keys: { eventId: string; submissionId: string }[],
  ): Promise<Item[]> {
    return this.table.batchGet(
      keys.map(({ eventId, submissionId }) => ({
        PK: eventKey(eventId),
        SK: submissionKey(submissionId),
      })),
    );
  }

  putSubmission(item: Item, condition?: string): Promise<void> {
    return this.table.put(item, condition);
  }

  replaceEditable(existing: Item, replacement: Item): Promise<Item> {
    const protectedFields = [
      'PK',
      'SK',
      'first_submitted_at',
      'first_submitted_at_source',
      'fully_approved_at',
    ];
    const set = Object.fromEntries(
      Object.entries(replacement).filter(
        ([key]) => !protectedFields.includes(key),
      ),
    );
    const names: Record<string, string> = { '#oldStatus': 'status' };
    const values: Item = { ':oldStatus': existing.status };
    const conditions = ['attribute_exists(PK)', '#oldStatus = :oldStatus'];
    for (const field of ['sent_at', 'current_signatory']) {
      names[`#old_${field}`] = field;
      if (existing[field] === undefined)
        conditions.push(`attribute_not_exists(#old_${field})`);
      else {
        conditions.push(`#old_${field} = :old_${field}`);
        values[`:old_${field}`] = existing[field];
      }
    }
    return this.table.update({
      key: { PK: existing.PK, SK: existing.SK },
      set,
      condition: conditions.join(' AND '),
      names,
      values,
    });
  }

  updateSubmission(
    eventId: string,
    submissionId: string,
    set: Record<string, unknown>,
    remove: string[] = [],
  ): Promise<Item> {
    return this.table.update({
      key: { PK: eventKey(eventId), SK: submissionKey(submissionId) },
      set: Object.fromEntries(
        Object.entries(set).filter(([key]) => key !== 'fully_approved_at'),
      ),
      ...(set.fully_approved_at !== undefined
        ? { setIfAbsent: { fully_approved_at: set.fully_approved_at } }
        : {}),
      remove,
    });
  }

  iterateOrgSubmissions(organizationId: string): AsyncGenerator<Item> {
    return this.table.queryItems({
      index: 'GSI1',
      keyCondition: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      values: { ':pk': organizationKey(organizationId), ':sk': 'SUBMISSION#' },
    });
  }

  listOrgSubmissions(organizationId: string): Promise<Item[]> {
    return this.table.query({
      index: 'GSI1',
      keyCondition: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      values: { ':pk': organizationKey(organizationId), ':sk': 'SUBMISSION#' },
    });
  }

  listOrgEvents(organizationId: string, limit = 25): Promise<Item[]> {
    return this.table.query({
      index: 'GSI1',
      keyCondition: 'GSI1PK = :pk',
      values: { ':pk': organizationKey(organizationId) },
      limit,
      allPages: false,
      scanForward: true,
    });
  }

  listQueue(signatoryId: string): Promise<Item[]> {
    return this.table.query({
      index: 'GSI2',
      keyCondition: 'GSI2PK = :pk',
      values: { ':pk': signatoryKey(signatoryId) },
    });
  }

  listDeadlines(eventId: string): Promise<Item[]> {
    return this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': eventKey(eventId), ':sk': 'DEADLINE#' },
    });
  }

  listNotifications(submissionId: string): Promise<Item[]> {
    return this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': submissionKey(submissionId), ':sk': 'NOTIFICATION#' },
    });
  }

  putNotification(item: Item): Promise<void> {
    return this.table.put(item);
  }

  putCollaboration(
    organizationId: string,
    eventId: string,
    submissionId: string,
    sentAt: string,
  ): Promise<void> {
    return this.table.put({
      PK: organizationKey(organizationId),
      SK: collaborationKey(eventId, submissionId),
      event_id: eventId,
      submission_id: submissionId,
      sent_at: sentAt,
    });
  }

  deleteCollaboration(
    organizationId: string,
    eventId: string,
    submissionId: string,
  ): Promise<void> {
    return this.table.delete(
      organizationKey(organizationId),
      collaborationKey(eventId, submissionId),
    );
  }

  listCollaborations(organizationId: string): Promise<Item[]> {
    return this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': organizationKey(organizationId), ':sk': 'COLLAB#' },
    });
  }

  /** Overwrite (or refresh) the CANCELWATCH# sentinel for a submission. */
  putCancelWatch(item: Item): Promise<void> {
    return this.table.put(item);
  }

  deleteCancelWatch(eventId: string, submissionId: string): Promise<void> {
    return this.table.delete(
      eventKey(eventId),
      cancelWatchKey(submissionId),
    );
  }

  /**
   * Move an `approved` submission to `cancelled` only if it is still approved.
   * Returns the ALL_NEW item; throws ConditionalCheckFailedException when the
   * submission is finished/denied/already-cancelled or missing (replay-safe).
   */
  cancelIfApproved(
    eventId: string,
    submissionId: string,
    cancelledAt: string,
  ): Promise<Item> {
    return this.table.update({
      key: { PK: eventKey(eventId), SK: submissionKey(submissionId) },
      set: { status: 'cancelled', cancelled_at: cancelledAt },
      condition: 'attribute_exists(PK) AND #status = :expected',
      names: { '#status': 'status' },
      values: { ':expected': 'approved' },
    });
  }
}

export function notificationItem(
  submissionId: string,
  signatoryId: string,
  notifType: string,
  comment: string,
  sentAt: string,
): Item {
  const signatory =
    signatoryId === ''
      ? ''
      : signatoryId.startsWith('SIGNATORY#')
        ? signatoryId
        : signatoryKey(signatoryId);
  return {
    PK: submissionKey(submissionId),
    SK: notificationKey(sentAt),
    signatory,
    notif_type: notifType,
    comment,
  };
}
