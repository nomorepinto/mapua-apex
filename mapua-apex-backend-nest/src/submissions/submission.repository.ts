import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import {
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

  putSubmission(item: Item, condition?: string): Promise<void> {
    return this.table.put(item, condition);
  }

  updateSubmission(
    eventId: string,
    submissionId: string,
    set: Record<string, unknown>,
    remove: string[] = [],
  ): Promise<Item> {
    return this.table.update({
      key: { PK: eventKey(eventId), SK: submissionKey(submissionId) },
      set,
      remove,
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
