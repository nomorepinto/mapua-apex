import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  BookingService,
  type PlannedBooking,
} from '../bookings/booking.service.js';
import {
  eventKey,
  nowIso,
  organizationKey,
  signatoryKey,
  stripPrefix,
  submissionKey,
} from '../common/dynamo-keys.js';
import {
  assertEventDateAllowed,
  eventDateFloorKey,
} from '../common/event-date.js';
import { abort } from '../common/http.js';
import { record, str, type Item } from '../common/records.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { CreateSaafDto, SaafDto } from './dto/saaf.dto.js';
import {
  dependentIds,
  RoutingService,
  type SignatoryStep,
} from './routing.service.js';
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
    const steps = await this.routing.sequenceFor(
      organizationId,
      dependents,
      body.activity_classification.activity_type,
      body.venue_reservation.has_reservation,
    );
    const sequence = steps.map((step) => step.signatory_id);
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
      steps,
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
    const frozenOsaar = await this.routing.frozenOsaarStageIds(existing);
    if (frozenOsaar.length === 0) {
      abort(422, 'This submission has no OSAAR stage to keep.');
    }
    const steps = await this.routing.sequenceFor(
      organizationId,
      dependents,
      body.activity_classification.activity_type,
      body.venue_reservation.has_reservation,
      frozenOsaar,
    );
    const sequence = steps.map((step) => step.signatory_id);
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
      steps,
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

  /**
   * OSAAR correction. Pending and returned papers can be rewritten in place.
   * Status, the current desk, the stored signatory sequence, and room holds
   * stay as filed. A paper that already reserves a room keeps its event date,
   * time, and venue.
   */
  async adminUpdate(
    eventId: string,
    submissionId: string,
    body: SaafDto,
  ): Promise<Item> {
    const existing = await this.submissions.getSubmission(
      eventId,
      submissionId,
    );
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const organizationId = stripPrefix(existing.GSI1PK, 'ORGANIZATION#');
    if (!organizationId) {
      throw new NotFoundException('Not Found');
    }
    const status = str(existing, 'status');
    if (status !== 'pending' && status !== 'returned') {
      abort(422, 'Only pending or returned submissions can be edited.');
    }
    const details = this.editedDetails(existing, body);
    const reserved = hasVenueReservation(existing);
    if (!reserved) {
      this.assertDates({
        ...body,
        activity_details: details,
        venue_reservation: { has_reservation: false },
      });
    }
    const dependents = await this.resolveDependents(
      organizationId,
      body.collaboration?.dependent_organization_ids ?? [],
    );
    const sentAt = str(existing, 'sent_at') ?? nowIso();
    const updated = await this.submissions.updateSubmission(
      eventId,
      submissionId,
      {
        collaboration: {
          dependent_organization_ids: dependents.map((id) =>
            organizationKey(id),
          ),
        },
        activity_classification: this.editedClassification(existing, body),
        proponents: body.proponents,
        activity_details: details,
        institutional_alignment: body.institutional_alignment,
        detailed_budget_proposal: body.detailed_budget_proposal,
      },
    );
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
    return updated;
  }

  private editedClassification(existing: Item, body: SaafDto) {
    const previous = record(existing.activity_classification);
    const nature = previous ? str(previous, 'nature') : null;
    return {
      ...body.activity_classification,
      ...(nature ? { nature } : {}),
    };
  }

  /** Keep the filed schedule when the paper already holds a room. */
  private editedDetails(existing: Item, body: SaafDto) {
    const details = { ...body.activity_details };
    if (!hasVenueReservation(existing)) {
      return details;
    }
    const previous = record(existing.activity_details);
    if (!previous) {
      return details;
    }
    const venue = str(previous, 'venue');
    const start = str(previous, 'date_of_event');
    const end = str(previous, 'end_date_of_event');
    const day = str(previous, 'day_of_event');
    const time = str(previous, 'time_of_event');
    return {
      ...details,
      ...(venue ? { venue } : {}),
      ...(start ? { date_of_event: start } : {}),
      ...(end ? { end_date_of_event: end } : {}),
      ...(day ? { day_of_event: day } : {}),
      ...(time ? { time_of_event: time } : {}),
    };
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
    const floor = eventDateFloorKey(this.config.allowAnyEventDate());
    assertEventDateAllowed(start, floor);
    if (body.venue_reservation.has_reservation) {
      for (const reservation of body.venue_reservation.reservations ?? []) {
        for (const selection of reservation.selections ?? []) {
          assertEventDateAllowed(selection.date, floor);
        }
      }
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
    steps: SignatoryStep[],
    desk: string,
    status: string,
    sentAt: string,
    planned: PlannedBooking[],
  ): Item {
    const refs = planned.map((row) => row.ref);
    const sequence = steps.map((step) => step.signatory_id);
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
      signatory_steps: steps.map((step) => ({
        key: step.key,
        role: step.role,
        signatory_id: signatoryKey(step.signatory_id),
        organization_id: step.organization_id
          ? organizationKey(step.organization_id)
          : null,
      })),
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

function hasVenueReservation(item: Item): boolean {
  const venue = record(item.venue_reservation);
  return venue?.has_reservation === true;
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
