import { Injectable } from '@nestjs/common';
import { nowIso, stripPrefix } from '../common/dynamo-keys.js';
import { isConditionalCheckFailed, str, type Item } from '../common/records.js';
import { AppConfigService } from '../config/app-config.service.js';
import { MailService } from '../mail/mail.service.js';
import { PostEvalRepository } from '../postevals/posteval.repository.js';
import {
  notificationItem,
  SubmissionRepository,
} from '../submissions/submission.repository.js';

/** The DynamoDB Streams record shape the consumer Lambda receives. */
interface StreamRecord {
  eventName?: string;
  dynamodb?: { Keys?: { PK?: { S?: string }; SK?: { S?: string } } };
}

export type CancelWatchResult =
  | { status: 'disabled' }
  | { status: 'post-eval filed' }
  | { status: 'not-approved' }
  | { status: 'ignored' }
  | { status: 'cancelled'; eventId: string; submissionId: string };

/**
 * Auto-cancels an approved submission once its post-evaluation window lapses
 * with no filed post-eval. Production drives `handleRecord` from a TTL-expiry
 * `REMOVE` on the `CANCELWATCH#` sentinel; the local-only admin route drives
 * `evaluateAndCancel` directly for the Playwright suite.
 */
@Injectable()
export class CancelWatchService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly postevals: PostEvalRepository,
    private readonly mail: MailService,
    private readonly config: AppConfigService,
  ) {}

  /** Stream adapter: translate a `REMOVE` on a sentinel into a cancel attempt. */
  async handleRecord(record: StreamRecord): Promise<CancelWatchResult> {
    if (record.eventName !== 'REMOVE') {
      return { status: 'ignored' };
    }
    const pk = record.dynamodb?.Keys?.PK?.S ?? '';
    const sk = record.dynamodb?.Keys?.SK?.S ?? '';
    if (!pk.startsWith('EVENT#') || !sk.startsWith('CANCELWATCH#')) {
      return { status: 'ignored' };
    }
    const eventId = stripPrefix(pk, 'EVENT#') ?? '';
    const submissionId = stripPrefix(sk, 'CANCELWATCH#') ?? '';
    if (eventId === '' || submissionId === '') {
      return { status: 'ignored' };
    }
    return this.evaluateAndCancel(eventId, submissionId);
  }

  /** The production cancel path, shared by the stream handler and the test trigger. */
  async evaluateAndCancel(
    eventId: string,
    submissionId: string,
  ): Promise<CancelWatchResult> {
    if (!this.config.autoCancelEnabled()) {
      return { status: 'disabled' };
    }
    // Never trust cross-key ordering: a sentinel REMOVE can arrive after the
    // org already filed, so re-check for any POSTEVAL# child before cancelling.
    const filed = await this.postevals.listForEvent(eventId, 'POSTEVAL#');
    if (filed.length > 0) {
      return { status: 'post-eval filed' };
    }
    const cancelledAt = nowIso();
    let updated: Item;
    try {
      updated = await this.submissions.cancelIfApproved(
        eventId,
        submissionId,
        cancelledAt,
      );
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        return { status: 'not-approved' };
      }
      throw error;
    }
    const days = this.config.postEvaluationWindowDays();
    const title =
      str(
        (updated.activity_details as Item | undefined) ?? {},
        'title_and_nature',
      ) ?? 'this event';
    const comment = `The ${days}-day post-evaluation window for ${title} closed with no post-evaluation filed, so it was automatically cancelled.`;
    await this.submissions.putNotification(
      notificationItem(
        submissionId,
        '',
        'event auto-cancelled',
        comment,
        cancelledAt,
      ),
    );
    await this.mail.decision(updated, 'event auto-cancelled', comment);
    return { status: 'cancelled', eventId, submissionId };
  }
}
