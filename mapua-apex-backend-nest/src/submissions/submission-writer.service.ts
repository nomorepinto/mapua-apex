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
import {
  PRIVACY_NOTICE_VERSION,
  privacyNoticeHash,
} from '../privacy/privacy-notice.js';
import { AppConfigService } from '../config/app-config.service.js';
import { TermSettingsService } from '../term-settings/term-settings.service.js';
import { assertTermDateAllowed } from '../term-settings/term-window.js';
import { addDays } from '../common/availability-window.js';
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
    private readonly terms: TermSettingsService,
  ) {}

  async create(organizationId: string, body: CreateSaafDto): Promise<Item> {
    await this.assertDates(body);
    this.assertConsent(body);
    const dependents = await this.resolveDependents(
      organizationId,
      body.collaboration?.dependent_organization_ids ?? [],
    );
    const activityDetails = await this.stampCampus(body.activity_details, body);
    const steps = await this.routing.sequenceFor(
      organizationId,
      dependents,
      body.activity_classification.activity_type,
      body.venue_reservation.has_reservation,
      undefined,
      activityDetails.campus_id,
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
      { ...body, activity_details: activityDetails },
      dependents,
      steps,
      sequence[0] ?? '',
      'pending',
      sentAt,
      planned,
    );
    item.first_submitted_at = sentAt;
    item.first_submitted_at_source = 'recorded';
    item.document_number =
      await this.submissions.allocateDocumentNumber(sentAt);
    item.privacy_consent = this.consentRecord(sentAt);
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
    await this.assertDates(body);
    this.assertConsent(body);
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
    const activityDetails = await this.stampCampus(
      this.editedDetails(existing, body),
      body,
      existing,
    );
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
      { ...body, activity_details: activityDetails },
      dependents,
      steps,
      desk,
      'pending',
      sentAt,
      planned,
    );
    // A student resubmit overwrites the stored consent with this fresh
    // acceptance; `replaceEditable` SETs it because it is not a protected field.
    item.privacy_consent = this.consentRecord(sentAt);
    const updated = await this.submissions.replaceEditable(existing, item);
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
    return { before: existing, after: updated };
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
    const details = await this.stampCampus(
      this.editedDetails(existing, body),
      body,
      existing,
    );
    const reserved = hasVenueReservation(existing);
    if (!reserved) {
      await this.assertDates({
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
        activity_classification: stored(
          this.editedClassification(existing, body),
        ),
        proponents: stored(body.proponents),
        activity_details: stored(details),
        institutional_alignment: stored(body.institutional_alignment),
        detailed_budget_proposal: stored(body.detailed_budget_proposal),
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

  /**
   * Writes the campus that owns this plan. An unchanged venue keeps the
   * campus already stored, including an online plan filed under a previous
   * main campus.
   */
  private async stampCampus(
    details: SaafDto['activity_details'],
    body: SaafDto,
    existing?: Item,
  ): Promise<SaafDto['activity_details'] & { campus_id: string }> {
    const venue = details.venue.trim();
    const previous = existing ? record(existing.activity_details) : null;
    const previousVenue = previous
      ? (str(previous, 'venue') ?? '').trim()
      : null;
    const previousCampus = previous ? str(previous, 'campus_id') : null;
    if (previousCampus && previousVenue === venue) {
      return { ...details, campus_id: previousCampus };
    }
    const reservationCampusIds = body.venue_reservation.has_reservation
      ? (body.venue_reservation.reservations ?? []).map((row) => row.campus_id)
      : [];
    const campusId = await this.routing.hostCampusId({
      venue,
      reservationCampusIds,
      keepOnlineCampusId: venue === 'Online' ? previousCampus : null,
    });
    return { ...details, campus_id: campusId };
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

  /**
   * Student create/resubmit must carry an accepted, current RA 10173 consent.
   * The DTO's `@IsIn` already rejects a stale version at the boundary; this
   * guard covers the absent case and re-checks acceptance so the write path
   * never persists a submission without a valid consent of record.
   */
  private assertConsent(body: SaafDto): void {
    const consent = body.privacy_consent;
    if (
      !consent ||
      consent.version !== PRIVACY_NOTICE_VERSION ||
      consent.accepted !== true
    ) {
      abort(422, 'Please review and accept the current data privacy notice.');
    }
  }

  /** Consent of record: the accepted version, when, the text hash, and channel. */
  private consentRecord(sentAt: string): Item {
    return {
      version: PRIVACY_NOTICE_VERSION,
      accepted_at: sentAt,
      notice_hash: privacyNoticeHash(),
      channel: 'web',
    };
  }

  private async assertDates(body: SaafDto): Promise<void> {
    const start = body.activity_details.date_of_event;
    const end = body.activity_details.end_date_of_event;
    const term = await this.terms.get();
    const floor = eventDateFloorKey(
      this.config.allowAnyEventDate(),
      undefined,
      term?.event_filing_lead_days,
    );
    if (end && end < start) {
      abort(422, 'The end date of event must be on or after the start date.');
    }
    assertEventDateAllowed(start, floor, term?.event_filing_lead_days);
    const lockoutDays = this.config.osaarTermLockoutDays();
    let cursor = start;
    const last = end || start;
    for (let checked = 0; cursor <= last && checked <= 366; checked += 1) {
      assertTermDateAllowed(cursor, term, lockoutDays);
      cursor = addDays(cursor, 1);
    }
    if (cursor <= last) abort(422, 'An event cannot span more than 367 days.');
    if (body.venue_reservation.has_reservation) {
      for (const reservation of body.venue_reservation.reservations ?? []) {
        for (const selection of reservation.selections ?? []) {
          assertEventDateAllowed(
            selection.date,
            floor,
            term?.event_filing_lead_days,
          );
          assertTermDateAllowed(selection.date, term, lockoutDays);
        }
      }
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
      activity_classification: stored(body.activity_classification),
      proponents: stored(body.proponents),
      activity_details: stored(body.activity_details),
      institutional_alignment: stored(body.institutional_alignment),
      detailed_budget_proposal: stored(body.detailed_budget_proposal),
      venue_reservation: stored(body.venue_reservation),
      ...(refs.length > 0 ? { booking_refs: refs } : {}),
    };
  }
}

/** DynamoDB rejects class-validator instances. Store the form as plain data. */
function stored<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
