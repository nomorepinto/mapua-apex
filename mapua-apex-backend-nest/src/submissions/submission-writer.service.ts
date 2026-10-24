import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BookingService,
  type PlannedBooking,
} from '../bookings/booking.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { addDays, utcToday } from '../common/availability-window.js';
import {
  eventKey,
  nowIso,
  organizationKey,
  signatoryKey,
  stripPrefix,
  submissionKey,
} from '../common/dynamo-keys.js';
import { abort } from '../common/http.js';
import { str, type Item } from '../common/records.js';
import type { CreateSaafDto, SaafDto } from './dto/saaf.dto.js';
import { dependentIds, RoutingService } from './routing.service.js';
import { SubmissionRepository } from './submission.repository.js';

@Injectable()
export class SubmissionWriterService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly routing: RoutingService,
    private readonly bookings: BookingService,
    private readonly config: AppConfigService,
  ) {}

  async create(organizationId: string, body: CreateSaafDto): Promise<Item> {
    this.assertDates(body);
    const dependents = await this.resolveDependents(
      organizationId,
      body.collaboration?.dependent_organization_ids ?? [],
    );
    const sequence = await this.routing.sequenceFor(
      organizationId,
      dependents,
      body.activity_classification.activity_type,
      body.venue_reservation.has_reservation,
    );
    await this.ensureEvent(body.event_id, organizationId);
    const submissionId = randomUUID();
    const sentAt = nowIso();
    const planned = await this.bookings.planForSubmission({
      hasReservation: body.venue_reservation.has_reservation,
      reservations: body.venue_reservation.reservations ?? [],
      organizationId,
      eventId: body.event_id,
      submissionId,
      expectedParticipants: body.activity_details.expected_participants,
      excludeSks: new Set(),
    });
    const item = this.item(
      body.event_id,
      submissionId,
      organizationId,
      body,
      dependents,
      sequence,
      sequence[0] ?? '',
      'pending',
      sentAt,
      planned,
    );
    await this.submissions.putSubmission(item, 'attribute_not_exists(SK)');
    await this.bookings.commit(planned);
    for (const dependent of dependents) {
      await this.submissions.putCollaboration(
        dependent,
        body.event_id,
        submissionId,
        sentAt,
      );
    }
    return item;
  }

  async update(
    organizationId: string,
    eventId: string,
    submissionId: string,
    body: SaafDto,
  ): Promise<{ before: Item; after: Item }> {
    this.assertDates(body);
    const event = await this.submissions.getEvent(eventId);
    if (
      !event ||
      stripPrefix(event.GSI1PK, 'ORGANIZATION#') !== organizationId
    ) {
      throw new NotFoundException('Not Found');
    }
    const existing = await this.submissions.getSubmission(
      eventId,
      submissionId,
    );
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const status = str(existing, 'status');
    if (status === 'approved') {
      abort(422, 'Approved submissions cannot be edited.');
    }
    if (status === 'denied') {
      abort(422, 'Denied submissions cannot be edited.');
    }
    if (status === 'finished') {
      abort(422, 'Finished submissions cannot be edited.');
    }
    if (status !== 'pending' && status !== 'returned') {
      abort(422, 'This submission cannot be edited.');
    }
    const dependents = await this.resolveDependents(
      organizationId,
      body.collaboration?.dependent_organization_ids ?? [],
    );
    const sequence = await this.routing.sequenceFor(
      organizationId,
      dependents,
      body.activity_classification.activity_type,
      body.venue_reservation.has_reservation,
    );
    const current = stripPrefix(existing.current_signatory, 'SIGNATORY#') ?? '';
    const keepDesk = status === 'returned' && sequence.includes(current);
    const desk = keepDesk ? current : (sequence[0] ?? '');
    const previousRefs = refsOf(existing);
    const planned = await this.bookings.planForSubmission({
      hasReservation: body.venue_reservation.has_reservation,
      reservations: body.venue_reservation.reservations ?? [],
      organizationId,
      eventId,
      submissionId,
      expectedParticipants: body.activity_details.expected_participants,
      excludeSks: new Set(previousRefs.map((ref) => ref.sk)),
    });
    const sentAt = nowIso();
    const item = this.item(
      eventId,
      submissionId,
      organizationId,
      body,
      dependents,
      sequence,
      desk,
      'pending',
      sentAt,
      planned,
    );
    await this.submissions.putSubmission(item);
    await this.bookings.releaseRefs(previousRefs);
    await this.bookings.commit(planned);
    const previousDependents = dependentIds(existing);
    for (const added of dependents.filter(
      (id) => !previousDependents.includes(id),
    )) {
      await this.submissions.putCollaboration(
        added,
        eventId,
        submissionId,
        sentAt,
      );
    }
    for (const removed of previousDependents.filter(
      (id) => !dependents.includes(id),
    )) {
      await this.submissions.deleteCollaboration(
        removed,
        eventId,
        submissionId,
      );
    }
    return { before: existing, after: item };
  }

  private async resolveDependents(
    organizationId: string,
    raw: string[],
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const value of raw) {
      const id = stripPrefix(value, 'ORGANIZATION#');
      if (!id || id === organizationId || ids.includes(id)) {
        continue;
      }
      ids.push(id);
    }
    return ids;
  }

  private assertDates(body: SaafDto): void {
    const start = body.activity_details.date_of_event;
    const end = body.activity_details.end_date_of_event;
    if (!this.config.allowAnyEventDate() && start < addDays(utcToday(), 10)) {
      abort(422, 'The date of event must be at least 10 days from today.');
    }
    if (end && end < start) {
      abort(422, 'The end date of event must be on or after the start date.');
    }
  }

  private async ensureEvent(
    eventId: string,
    organizationId: string,
  ): Promise<void> {
    const existing = await this.submissions.getEvent(eventId);
    if (!existing) {
      const key = eventKey(eventId);
      const sentAt = nowIso();
      await this.submissions.putEvent({
        PK: key,
        SK: key,
        GSI1PK: organizationKey(organizationId),
        GSI1SK: sentAt,
      });
      return;
    }
    if (stripPrefix(existing.GSI1PK, 'ORGANIZATION#') !== organizationId) {
      throw new NotFoundException('Not Found');
    }
  }

  private item(
    eventId: string,
    submissionId: string,
    organizationId: string,
    body: SaafDto,
    dependents: string[],
    sequence: string[],
    desk: string,
    status: string,
    sentAt: string,
    planned: PlannedBooking[],
  ): Item {
    const refs = planned.map((row) => row.ref);
    return {
      PK: eventKey(eventId),
      SK: submissionKey(submissionId),
      GSI1PK: organizationKey(organizationId),
      GSI1SK: submissionKey(submissionId),
      GSI2PK: signatoryKey(desk),
      GSI2SK: sentAt,
      submission_type: body.submission_type,
      sent_at: sentAt,
      status,
      current_signatory: signatoryKey(desk),
      signatory_sequence: sequence.map((id) => signatoryKey(id)),
      collaboration: {
        dependent_organization_ids: dependents.map((id) => organizationKey(id)),
      },
      activity_classification: body.activity_classification,
      proponents: body.proponents,
      activity_details: body.activity_details,
      institutional_alignment: body.institutional_alignment,
      detailed_budget_proposal: body.detailed_budget_proposal,
      venue_reservation: body.venue_reservation,
      ...(refs.length > 0 ? { booking_refs: refs } : {}),
    };
  }
}

export function refsOf(item: Item): { pk: string; sk: string }[] {
  const refs = item.booking_refs;
  if (!Array.isArray(refs)) {
    return [];
  }
  return refs.flatMap((ref) => {
    if (typeof ref !== 'object' || ref === null) {
      return [];
    }
    const pk = str(ref as Item, 'pk');
    const sk = str(ref as Item, 'sk');
    return pk && sk ? [{ pk, sk }] : [];
  });
}
