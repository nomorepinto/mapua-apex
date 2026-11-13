import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingService,
  type BookingConflict,
} from '../bookings/booking.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import {
  eventKey,
  cancelWatchKey,
  nowIso,
  signatoryKey,
  stripPrefix,
} from '../common/dynamo-keys.js';
import { abort } from '../common/http.js';
import { evaluationWindowTtl } from '../common/manila.js';
import { bool, list, num, record, str, type Item } from '../common/records.js';
import { MailService } from '../mail/mail.service.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';
import { refsOf } from './submission-writer.service.js';
import {
  notificationItem,
  SubmissionRepository,
} from './submission.repository.js';
import { dependentIds, RoutingService } from './routing.service.js';
import {
  appendDeskTiming,
  type DeskTimingAction,
  type DeskTimingEntry,
} from './desk-timing.js';

@Injectable()
export class SubmissionReviewService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly bookings: BookingService,
    private readonly mail: MailService,
    private readonly routing: RoutingService,
    private readonly config: AppConfigService,
    private readonly organizations: OrganizationRepository,
    private readonly signatories: SignatoryRepository,
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
        undefined,
        await this.routing.hostCampusId({
          venue: str(record(item.activity_details) ?? {}, 'venue') ?? '',
          reservationCampusIds: hasReservation(item)
            ? reservationCampusIds(item)
            : [],
          keepOnlineCampusId: str(
            record(item.activity_details) ?? {},
            'campus_id',
          ),
        }),
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
    await this.assertOutsideEquipmentDecided(item, bareDesk);
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
          ...this.timingSet(item, bareDesk, 'approved', sentAt),
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
        fully_approved_at: str(item, 'fully_approved_at') ?? sentAt,
        current_signatory: signatoryKey(bareDesk),
        signatory_sequence: sequence,
        ...this.timingSet(item, bareDesk, 'fully approved', sentAt),
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
    const skipsPostEval = org?.skip_post_eval === true;
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
    if (!skipsPostEval && this.config.autoCancelEnabled()) {
      const rawDate = str(record(item.activity_details) ?? {}, 'date_of_event');
      const ttl = evaluationWindowTtl(rawDate, days);
      if (ttl !== null) {
        await this.submissions.putCancelWatch({
          PK: eventKey(eventId),
          SK: cancelWatchKey(submissionId),
          entity_type: 'cancelwatch',
          event_id: eventId,
          submission_id: submissionId,
          organization_id: orgId,
          created_at: sentAt,
          TTL: ttl,
        });
      }
    }
    return updated;
  }

  async returnForRevision(
    signatoryId: string,
    eventId: string,
    submissionId: string,
    comment: string,
  ): Promise<Item> {
    const item = await this.requireOpen(signatoryId, eventId, submissionId);
    await this.bookings.releaseRefs(
      refsOf(await this.must(eventId, submissionId)),
    );
    const actedAt = nowIso();
    const updated = await this.submissions.updateSubmission(
      eventId,
      submissionId,
      {
        status: 'returned',
        ...this.timingSet(
          item,
          stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId,
          'returned',
          actedAt,
        ),
      },
      ['booking_refs'],
    );
    await this.notify(
      submissionId,
      signatoryId,
      'returned',
      comment,
      actedAt,
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
    const actedAt = nowIso();
    const updated = await this.submissions.updateSubmission(
      eventId,
      submissionId,
      {
        status: 'denied',
        ...this.timingSet(
          item,
          stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId,
          'denied',
          actedAt,
        ),
      },
      ['GSI2PK', 'GSI2SK', 'booking_refs'],
    );
    await this.notify(
      submissionId,
      signatoryId,
      'denied',
      comment,
      actedAt,
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
    // Major/minor classification is exclusive to the all-campus OSAAR (R-1).
    const acting = await this.signatories.get(
      stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId,
    );
    if (
      !acting ||
      str(acting, 'role') !== 'osaar' ||
      !bool(acting, 'all_campuses')
    ) {
      abort(
        403,
        'Only the all-campus OSAAR can classify an event as major or minor.',
      );
    }
    const current = await this.must(eventId, submissionId);
    const previous = record(current.activity_classification);
    const classification = previous
      ? { ...previous, nature: nature.toLowerCase() }
      : { nature: nature.toLowerCase() };
    return this.submissions.updateSubmission(eventId, submissionId, {
      activity_classification: classification,
    });
  }

  /**
   * Records the CDM's per-item allowed/not-allowed decisions for outside
   * equipment (S-8). The CDM must rule on every item before approving.
   */
  async setOutsideEquipmentDecisions(
    signatoryId: string,
    eventId: string,
    submissionId: string,
    decisions: { name: string; allowed: boolean }[],
  ): Promise<Item> {
    const item = await this.requireOpen(signatoryId, eventId, submissionId);
    const acting = await this.signatories.get(
      stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId,
    );
    if (!acting || str(acting, 'role') !== 'cdm') {
      abort(403, 'Only the CDM desk can rule on outside equipment.');
    }
    const listed = outsideEquipmentNames(item);
    for (const decision of decisions) {
      if (!listed.includes(decision.name)) {
        abort(422, `"${decision.name}" is not listed as outside equipment.`);
      }
    }
    // Merge the incoming rulings into any already-stored decisions, keyed by the
    // declared item name. The CDM rules one item per click, so a PATCH may carry
    // only that item; replacing the whole array would drop the other items'
    // earlier rulings and leave the approve gate stuck forever. Last write wins
    // per name, and rulings for items no longer listed are pruned.
    const stamp = nowIso();
    const byName = new Map<string, Item>();
    for (const entry of list(item, 'outside_equipment_decisions')) {
      const stored = record(entry);
      if (!stored) {
        continue;
      }
      const name = str(stored, 'name');
      if (name && listed.includes(name)) {
        byName.set(name, stored);
      }
    }
    for (const decision of decisions) {
      byName.set(decision.name, {
        name: decision.name,
        allowed: decision.allowed,
        decided_at: stamp,
      });
    }
    const merged = listed
      .map((name) => byName.get(name))
      .filter((entry): entry is Item => entry !== undefined);
    return this.submissions.updateSubmission(eventId, submissionId, {
      outside_equipment_decisions: merged,
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

  /**
   * CDM approve gate (S-8): when the acting desk is CDM and outside equipment
   * is listed, every item needs a stored allowed/not-allowed decision first.
   */
  private async assertOutsideEquipmentDecided(
    item: Item,
    bareDesk: string,
  ): Promise<void> {
    const listed = outsideEquipmentNames(item);
    if (listed.length === 0) {
      return;
    }
    const acting = await this.signatories.get(bareDesk);
    if (!acting || str(acting, 'role') !== 'cdm') {
      return;
    }
    const decided = new Set(
      list(item, 'outside_equipment_decisions')
        .map((entry) => record(entry))
        .filter((entry): entry is Item => entry !== null)
        .flatMap((entry) => {
          const name = str(entry, 'name');
          return name ? [name] : [];
        }),
    );
    const undecided = listed.filter((name) => !decided.has(name));
    if (undecided.length > 0) {
      abort(
        422,
        `Record an allowed/not-allowed decision for every outside equipment item before approving: ${undecided.join(', ')}.`,
      );
    }
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

  /**
   * `desk_timings` SET payload for a live decision. Resolves the acting desk's
   * stage/role/org from the submission's stored `signatory_steps` (no extra
   * DynamoDB read) and omits the key entirely when the desk clock cannot be
   * established without guessing.
   */
  private timingSet(
    item: Item,
    bareDesk: string,
    action: DeskTimingAction,
    actedAt: string,
  ): { desk_timings?: DeskTimingEntry[] } {
    const steps = Array.isArray(item.signatory_steps)
      ? item.signatory_steps
      : [];
    const link = steps
      .map((step) => record(step))
      .filter((step): step is Item => step !== null)
      .find(
        (step) =>
          (stripPrefix(step.signatory_id, 'SIGNATORY#') ??
            str(step, 'signatory_id')) === bareDesk,
      );
    const timings = appendDeskTiming(item, {
      signatory_id: bareDesk,
      stage_key: link ? str(link, 'key') : null,
      role: link ? str(link, 'role') : null,
      organization_id: link
        ? stripPrefix(link.organization_id, 'ORGANIZATION#')
        : null,
      action,
      acted_at: actedAt,
    });
    return timings ? { desk_timings: timings } : {};
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

function outsideEquipmentNames(item: Item): string[] {
  const venue = record(item.venue_reservation);
  if (!venue) {
    return [];
  }
  return list(venue, 'outside_equipment')
    .map((entry) => record(entry))
    .filter((entry): entry is Item => entry !== null)
    .flatMap((entry) => {
      const name = str(entry, 'name');
      return name ? [name] : [];
    });
}

function reservationCampusIds(item: Item): string[] {
  const venue = record(item.venue_reservation);
  if (!venue || !Array.isArray(venue.reservations)) {
    return [];
  }
  return venue.reservations.flatMap((entry) => {
    const row = record(entry);
    const id = row ? str(row, 'campus_id') : null;
    return id ? [id] : [];
  });
}

function expectedParticipants(item: Item): number | null {
  return num(record(item.activity_details) ?? {}, 'expected_participants');
}
