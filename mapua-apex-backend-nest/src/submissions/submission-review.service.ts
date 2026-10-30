import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingService,
  type BookingConflict,
} from '../bookings/booking.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { nowIso, signatoryKey, stripPrefix } from '../common/dynamo-keys.js';
import { abort } from '../common/http.js';
import { num, record, str, type Item } from '../common/records.js';
import { MailService } from '../mail/mail.service.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { refsOf } from './submission-writer.service.js';
import {
  notificationItem,
  SubmissionRepository,
} from './submission.repository.js';
import { dependentIds, RoutingService } from './routing.service.js';

@Injectable()
export class SubmissionReviewService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly bookings: BookingService,
    private readonly mail: MailService,
    private readonly routing: RoutingService,
    private readonly config: AppConfigService,
    private readonly organizations: OrganizationRepository,
  ) {}

  async approve(
    signatoryId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item> {
    const item = await this.requireOpen(signatoryId, eventId, submissionId);
    let sequence = prefixedSequence(item);
    if (sequence.length === 0) {
      const orgId = stripPrefix(item.GSI1PK, 'ORGANIZATION#') ?? '';
      const steps = await this.routing.sequenceFor(
        orgId,
        dependentIds(item),
        activityType(item),
        hasReservation(item),
      );
      sequence = steps.map((step) => signatoryKey(step.signatory_id));
    }
    const bareDesk = stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId;
    const index = sequence.findIndex(
      (id) => stripPrefix(id, 'SIGNATORY#') === bareDesk,
    );
    if (index === -1) {
      throw new NotFoundException('Not Found');
    }
    const next = sequence[index + 1];
    const sentAt = nowIso();
    if (next) {
      const updated = await this.submissions.updateSubmission(
        eventId,
        submissionId,
        {
          status: 'pending',
          current_signatory: next,
          signatory_sequence: sequence,
          GSI2PK: next,
          GSI2SK: sentAt,
        },
      );
      await this.notify(
        submissionId,
        bareDesk,
        'approved',
        '',
        sentAt,
        updated,
      );
      await this.mail.decision(
        updated,
        'approved',
        '',
        stripPrefix(next, 'SIGNATORY#'),
      );
      return updated;
    }
    const conflicts = await this.bookings.conflictsForRefs(
      refsOf(item),
      expectedParticipants(item),
    );
    if (conflicts[0]) {
      const message = conflicts[0].message.replace(' Pick another time.', '');
      abort(
        409,
        `${message} Return or deny this proposal so the organization can pick another time.`,
      );
    }
    await this.bookings.approveRefs(refsOf(item), bareDesk);
    const updated = await this.submissions.updateSubmission(
      eventId,
      submissionId,
      {
        status: 'approved',
        current_signatory: signatoryKey(bareDesk),
        signatory_sequence: sequence,
      },
      ['GSI2PK', 'GSI2SK'],
    );
    await this.notify(
      submissionId,
      bareDesk,
      'fully approved',
      '',
      sentAt,
      updated,
    );
    const scheduledAt = new Date(Date.parse(sentAt) + 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const date =
      str(record(item.activity_details) ?? {}, 'date_of_event') ??
      'the scheduled date';
    const orgId = stripPrefix(item.GSI1PK, 'ORGANIZATION#') ?? '';
    const org = orgId ? await this.organizations.get(orgId) : undefined;
    const skipsPostEval = org?.is_higher_council === true;
    const days = this.config.postEvaluationWindowDays();
    const comment = skipsPostEval
      ? `Your event will happen on ${date}. A post-evaluation is not required for this organization.`
      : `Your event will happen on ${date}. You have ${days} days to evaluate attendees after that date.`;
    await this.notify(
      submissionId,
      bareDesk,
      'event scheduled',
      comment,
      scheduledAt,
      updated,
    );
    await this.mail.decision(updated, 'fully approved', '', null);
    await this.mail.decision(
      updated,
      skipsPostEval ? 'event scheduled no posteval' : 'event scheduled',
      comment,
      null,
    );
    return updated;
  }

  async returnForRevision(
    signatoryId: string,
    eventId: string,
    submissionId: string,
    comment: string,
  ): Promise<Item> {
    await this.requireOpen(signatoryId, eventId, submissionId);
    await this.bookings.releaseRefs(
      refsOf(await this.must(eventId, submissionId)),
    );
    const updated = await this.submissions.updateSubmission(
      eventId,
      submissionId,
      { status: 'returned' },
      ['booking_refs'],
    );
    await this.notify(
      submissionId,
      signatoryId,
      'returned',
      comment,
      nowIso(),
      updated,
    );
    await this.mail.decision(updated, 'returned', comment, null);
    return updated;
  }

  async deny(
    signatoryId: string,
    eventId: string,
    submissionId: string,
    comment: string,
  ): Promise<Item> {
    const item = await this.requireOpen(signatoryId, eventId, submissionId);
    await this.bookings.releaseRefs(refsOf(item));
    const updated = await this.submissions.updateSubmission(
      eventId,
      submissionId,
      { status: 'denied' },
      ['GSI2PK', 'GSI2SK', 'booking_refs'],
    );
    await this.notify(
      submissionId,
      signatoryId,
      'denied',
      comment,
      nowIso(),
      updated,
    );
    await this.mail.decision(updated, 'denied', comment, null);
    return updated;
  }

  async classify(
    signatoryId: string,
    eventId: string,
    submissionId: string,
    nature: string,
  ): Promise<Item> {
    await this.requireOpen(signatoryId, eventId, submissionId);
    const current = await this.must(eventId, submissionId);
    const previous = record(current.activity_classification);
    const classification = previous
      ? { ...previous, nature: nature.toLowerCase() }
      : { nature: nature.toLowerCase() };
    return this.submissions.updateSubmission(eventId, submissionId, {
      activity_classification: classification,
    });
  }

  async bookingConflicts(
    signatoryId: string,
    eventId: string,
    submissionId: string,
  ): Promise<BookingConflict[]> {
    const item = await this.requireVisible(signatoryId, eventId, submissionId);
    return this.bookings.conflictsForRefs(
      refsOf(item),
      expectedParticipants(item),
    );
  }

  private async requireOpen(
    signatoryId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item> {
    const item = await this.must(eventId, submissionId);
    const desk = stripPrefix(
      item.GSI2PK ?? item.current_signatory,
      'SIGNATORY#',
    );
    if (desk !== (stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId)) {
      throw new NotFoundException('Not Found');
    }
    const status = str(item, 'status');
    if (status !== 'pending' && status !== 'returned') {
      abort(422, 'This submission is no longer open for review.');
    }
    return item;
  }

  private async requireVisible(
    signatoryId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item> {
    const item = await this.must(eventId, submissionId);
    const bare = stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId;
    const onDesk =
      stripPrefix(item.GSI2PK ?? item.current_signatory, 'SIGNATORY#') === bare;
    const inSequence = prefixedSequence(item).some(
      (id) => stripPrefix(id, 'SIGNATORY#') === bare,
    );
    if (!onDesk && !inSequence) {
      throw new NotFoundException('Not Found');
    }
    return item;
  }

  private async must(eventId: string, submissionId: string): Promise<Item> {
    const item = await this.submissions.getSubmission(eventId, submissionId);
    if (!item) {
      throw new NotFoundException('Not Found');
    }
    return item;
  }

  private async notify(
    submissionId: string,
    signatoryId: string,
    notifType: string,
    comment: string,
    sentAt: string,
    submission: Item,
  ): Promise<void> {
    await this.submissions.putNotification(
      notificationItem(submissionId, signatoryId, notifType, comment, sentAt),
    );
    void submission;
  }
}

function prefixedSequence(item: Item): string[] {
  return Array.isArray(item.signatory_sequence)
    ? item.signatory_sequence.map(String)
    : [];
}

function activityType(item: Item): string {
  return str(record(item.activity_classification) ?? {}, 'activity_type') ?? '';
}

function hasReservation(item: Item): boolean {
  return record(item.venue_reservation)?.has_reservation === true;
}

function expectedParticipants(item: Item): number | null {
  return num(record(item.activity_details) ?? {}, 'expected_participants');
}
