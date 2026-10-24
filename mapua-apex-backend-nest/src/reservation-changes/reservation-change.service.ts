import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BookingService } from '../bookings/booking.service.js';
import {
  campusKey,
  eventKey,
  nowIso,
  reservationChangeKey,
  signatoryKey,
  stripPrefix,
} from '../common/dynamo-keys.js';
import { abort } from '../common/http.js';
import { endOfManilaDay } from '../common/manila.js';
import { num, record, str, type Item } from '../common/records.js';
import { MailService } from '../mail/mail.service.js';
import {
  normalizeSelections,
  slotEnd,
  slotStart,
  type Selection,
} from '../reservables/schedule.js';
import { ReservableRepository } from '../reservables/reservable.repository.js';
import {
  notificationItem,
  SubmissionRepository,
} from '../submissions/submission.repository.js';
import { dependentIds } from '../submissions/routing.service.js';
import { refsOf } from '../submissions/submission-writer.service.js';
import { DynamoTable } from '../aws/dynamo-table.js';

@Injectable()
export class ReservationChangeService {
  constructor(
    private readonly table: DynamoTable,
    private readonly submissions: SubmissionRepository,
    private readonly bookings: BookingService,
    private readonly reservables: ReservableRepository,
    private readonly mail: MailService,
  ) {}

  async request(
    organizationId: string,
    sub: string,
    eventId: string,
    submissionId: string,
    requestType: string,
    reason: string,
    suggestedDate?: string,
  ): Promise<Item> {
    const submission = await this.requireProponent(
      organizationId,
      eventId,
      submissionId,
    );
    if (str(submission, 'status') !== 'approved') {
      abort(409, "Only an approved submission's reservation can be changed.");
    }
    const refs = refsOf(submission);
    if (refs.length === 0) {
      abort(
        409,
        'This submission has no room or equipment reservation to change.',
      );
    }
    const date = str(
      record(submission.activity_details) ?? {},
      'date_of_event',
    );
    const closes = date ? endOfManilaDay(date) : null;
    if (!closes) {
      abort(409, 'This submission has no scheduled event date to change.');
    }
    if (new Date() > closes) {
      abort(409, 'Reservation changes close at the end of the event day.');
    }
    if (await this.hasPending(eventId, submissionId)) {
      abort(409, 'A reservation change is already pending for this event.');
    }
    const snapshot = await this.snapshot(refs, submission);
    const campusId = snapshot.campusId;
    if (campusId === '') {
      abort(409, 'This reservation is missing a campus and cannot be changed.');
    }
    const changeId = randomUUID();
    const requestedAt = nowIso();
    const item: Item = {
      PK: eventKey(eventId),
      SK: reservationChangeKey(changeId),
      GSI6PK: campusKey(campusId),
      GSI6SK: `pending#${requestedAt}`,
      item_type: 'reservation_change',
      organization_id: organizationId,
      submission_id: submissionId,
      campus_id: campusId,
      requested_by: `STUDENT#${sub}`,
      requested_at: requestedAt,
      request_type: requestType,
      reason,
      bookings: snapshot.holds,
      status: 'pending',
      ...(suggestedDate ? { suggested_date: suggestedDate } : {}),
    };
    await this.table.put(item);
    await this.submissions.putNotification(
      notificationItem(
        submissionId,
        '',
        'reservation change requested',
        reason,
        requestedAt,
      ),
    );
    return this.view(item);
  }

  async listForStudent(
    organizationId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item[]> {
    await this.requireReadable(organizationId, eventId, submissionId);
    const rows = await this.listForSubmission(eventId, submissionId);
    return rows.map((row) => this.view(row));
  }

  async listForCampus(campusId: string, status?: string): Promise<Item[]> {
    const rows = await this.table.query({
      index: 'GSI6',
      keyCondition: 'GSI6PK = :pk',
      values: { ':pk': campusKey(campusId) },
    });
    const filtered = rows.filter(
      (row) => !status || status === 'all' || str(row, 'status') === status,
    );
    filtered.sort((left, right) =>
      String(right.requested_at).localeCompare(String(left.requested_at)),
    );
    const views: Item[] = [];
    for (const row of filtered) {
      const eventId = stripPrefix(row.PK, 'EVENT#') ?? '';
      const submissionId = str(row, 'submission_id') ?? '';
      const submission = submissionId
        ? await this.submissions.getSubmission(eventId, submissionId)
        : undefined;
      views.push(this.view(row, submission));
    }
    return views;
  }

  async showForCampus(campusId: string, changeId: string): Promise<Item> {
    const row = await this.find(campusId, changeId);
    const eventId = stripPrefix(row.PK, 'EVENT#') ?? '';
    const submission = await this.submissions.getSubmission(
      eventId,
      str(row, 'submission_id') ?? '',
    );
    return this.view(row, submission, true);
  }

  async resolve(
    campusId: string,
    changeId: string,
    signatoryId: string,
    input: { decision: string; comment?: string; bookings?: object[] },
  ): Promise<Item> {
    const change = await this.find(campusId, changeId);
    if (str(change, 'status') !== 'pending') {
      abort(409, 'This reservation change has already been resolved.');
    }
    const eventId = stripPrefix(change.PK, 'EVENT#') ?? '';
    const submissionId = str(change, 'submission_id') ?? '';
    const submission = await this.submissions.getSubmission(
      eventId,
      submissionId,
    );
    if (!submission || str(submission, 'status') !== 'approved') {
      abort(409, "Only an approved submission's reservation can be changed.");
    }
    if (input.decision === 'cancel') {
      return this.cancel(
        change,
        submission,
        eventId,
        submissionId,
        signatoryId,
        input.comment ?? '',
      );
    }
    if (input.decision === 'deny') {
      if (!input.comment?.trim()) {
        abort(422, 'A comment is required to deny a reservation change.');
      }
      return this.deny(
        change,
        submission,
        submissionId,
        signatoryId,
        input.comment.trim(),
      );
    }
    if (input.decision === 'reschedule') {
      return this.reschedule(
        change,
        submission,
        eventId,
        submissionId,
        signatoryId,
        input.comment ?? '',
        input.bookings ?? [],
      );
    }
    abort(422, 'Unknown reservation change decision.');
  }

  private async cancel(
    change: Item,
    submission: Item,
    eventId: string,
    submissionId: string,
    signatoryId: string,
    comment: string,
  ): Promise<Item> {
    const live = refsOf(submission);
    await this.bookings.releaseRefs(live);
    await this.submissions.updateSubmission(
      eventId,
      submissionId,
      { status: 'cancelled' },
      ['booking_refs'],
    );
    const text = comment || 'Your event reservation was cancelled.';
    await this.notify(
      submissionId,
      signatoryId,
      'reservation cancelled',
      text,
      { ...submission, status: 'cancelled' },
    );
    return this.finalize(change, {
      decision: 'cancel',
      resolved_by: signatoryKey(signatoryId),
      comment,
      status: 'resolved',
      applied: {
        bookings: [],
        submission: { status_after: 'cancelled', booking_refs_after: [] },
      },
    });
  }

  private async deny(
    change: Item,
    submission: Item,
    submissionId: string,
    signatoryId: string,
    comment: string,
  ): Promise<Item> {
    await this.notify(
      submissionId,
      signatoryId,
      'reservation change denied',
      comment,
      submission,
    );
    return this.finalize(change, {
      decision: 'deny',
      resolved_by: signatoryKey(signatoryId),
      comment,
      status: 'denied',
      applied: { bookings: [], submission: null },
    });
  }

  private async reschedule(
    change: Item,
    submission: Item,
    eventId: string,
    submissionId: string,
    signatoryId: string,
    comment: string,
    instructions: object[],
  ): Promise<Item> {
    const snapshot = Array.isArray(change.bookings)
      ? (change.bookings as Item[])
      : [];
    if (snapshot.length === 0) {
      abort(
        409,
        'This reservation change no longer references any live booking.',
      );
    }
    const live = refsOf(submission);
    const liveKeys = new Set(live.map((ref) => `${ref.pk}\0${ref.sk}`));
    for (const hold of snapshot) {
      if (!liveKeys.has(`${str(hold, 'pk')}\0${str(hold, 'sk')}`)) {
        abort(
          409,
          'The reservation changed since this request was made. Deny it and ask the student to request again.',
        );
      }
    }
    const byRef = new Map(
      instructions.map((row) => [
        `${str(row as Item, 'pk')}\0${str(row as Item, 'sk')}`,
        row as Item,
      ]),
    );
    const exclude = new Set(live.map((ref) => ref.sk));
    const expected = num(
      record(submission.activity_details) ?? {},
      'expected_participants',
    );
    const campusId = str(change, 'campus_id') ?? '';
    const organizationId = str(change, 'organization_id') ?? '';
    const newRefs: { pk: string; sk: string }[] = [];
    const reservations: Item[] = [];
    const selections: Selection[] = [];
    for (const hold of snapshot) {
      const pk = str(hold, 'pk') ?? '';
      const sk = str(hold, 'sk') ?? '';
      const instruction = byRef.get(`${pk}\0${sk}`);
      const action = str(instruction ?? {}, 'action') ?? 'keep';
      const current = normalizeSelections(hold.schedule_selected);
      if (action === 'keep') {
        newRefs.push({ pk, sk });
        reservations.push(this.reservation(hold, campusId, current));
        selections.push(...current);
        continue;
      }
      const next = normalizeSelections(instruction?.selections);
      if (next.length === 0) {
        abort(
          422,
          'Select at least one date and time slot for each changed hold.',
        );
      }
      if (action === 'update') {
        const reservableId = str(hold, 'reservable_id') ?? '';
        const reservable = await this.reservables.get(campusId, reservableId);
        if (!reservable) {
          abort(422, 'The selected room or equipment does not exist.');
        }
        await this.bookings.assertAvailable(
          reservable,
          next,
          exclude,
          expected,
        );
        await this.bookings.updateSchedule(pk, sk, next);
        newRefs.push({ pk, sk });
        reservations.push(this.reservation(hold, campusId, next));
        selections.push(...next);
        continue;
      }
      const newId =
        stripPrefix(instruction?.new_reservable_id, 'RESERVABLE#') ?? '';
      if (newId === '') {
        abort(422, 'A room swap must name the new room or equipment.');
      }
      const reservable = await this.reservables.get(campusId, newId);
      if (!reservable) {
        abort(422, 'The selected room or equipment does not exist.');
      }
      await this.bookings.assertAvailable(reservable, next, exclude, expected);
      const created = await this.bookings.createApprovedForSubmission({
        reservable,
        campusId,
        selections: next,
        organizationId,
        eventId,
        submissionId,
      });
      await this.bookings.releaseRefs([{ pk, sk }]);
      newRefs.push(created);
      reservations.push({
        reservable_id: newId,
        campus_id: campusId,
        name: str(reservable, 'name'),
        type: str(reservable, 'type'),
        selections: next,
      });
      selections.push(...next);
    }
    const timing = deriveTiming(selections);
    const previousDetails = record(submission.activity_details);
    const details = previousDetails ? { ...previousDetails, ...timing } : { ...timing };
    const previousVenue = record(submission.venue_reservation);
    const venue = previousVenue
      ? { ...previousVenue, has_reservation: true, reservations }
      : { has_reservation: true, reservations };
    await this.submissions.updateSubmission(eventId, submissionId, {
      activity_details: details,
      venue_reservation: venue,
      booking_refs: newRefs,
    });
    const text = comment || 'Your event reservation was updated.';
    await this.notify(
      submissionId,
      signatoryId,
      'reservation rescheduled',
      text,
      submission,
    );
    return this.finalize(change, {
      decision: 'reschedule',
      resolved_by: signatoryKey(signatoryId),
      comment,
      status: 'resolved',
      applied: {
        bookings: [],
        submission: { status_after: 'approved', ...timing },
      },
    });
  }

  private reservation(
    hold: Item,
    campusId: string,
    selections: Selection[],
  ): Item {
    return {
      reservable_id: str(hold, 'reservable_id'),
      campus_id: campusId,
      name: str(hold, 'reservable_name'),
      type: str(hold, 'reservable_type'),
      selections,
    };
  }

  private async notify(
    submissionId: string,
    signatoryId: string,
    kind: string,
    comment: string,
    submission: Item,
  ): Promise<void> {
    await this.submissions.putNotification(
      notificationItem(submissionId, signatoryId, kind, comment, nowIso()),
    );
    await this.mail.decision(submission, kind, comment, null);
  }

  private async finalize(change: Item, fields: Item): Promise<Item> {
    const status = str(fields, 'status') ?? 'resolved';
    const requestedAt = str(change, 'requested_at') ?? nowIso();
    const updated: Item = {
      ...change,
      ...fields,
      status,
      resolved_at: nowIso(),
      GSI6SK: `${status}#${requestedAt}`,
    };
    await this.table.put(updated, 'attribute_not_exists(resolved_at)');
    return this.view(updated);
  }

  private async find(campusId: string, changeId: string): Promise<Item> {
    const target = reservationChangeKey(changeId);
    const rows = await this.table.query({
      index: 'GSI6',
      keyCondition: 'GSI6PK = :pk',
      values: { ':pk': campusKey(campusId) },
    });
    const found = rows.find((row) => row.SK === target);
    if (!found) {
      throw new NotFoundException('Not Found');
    }
    return found;
  }

  private async hasPending(
    eventId: string,
    submissionId: string,
  ): Promise<boolean> {
    const rows = await this.listForSubmission(eventId, submissionId);
    return rows.some((row) => str(row, 'status') === 'pending');
  }

  private async listForSubmission(
    eventId: string,
    submissionId: string,
  ): Promise<Item[]> {
    const rows = await this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': eventKey(eventId), ':sk': 'RESERVATION_CHANGE#' },
    });
    return rows
      .filter((row) => str(row, 'submission_id') === submissionId)
      .sort((left, right) =>
        String(right.requested_at).localeCompare(String(left.requested_at)),
      );
  }

  private async snapshot(
    refs: { pk: string; sk: string }[],
    submission: Item,
  ): Promise<{ holds: Item[]; campusId: string }> {
    const venue = record(submission.venue_reservation);
    const first = Array.isArray(venue?.reservations)
      ? (venue.reservations[0] as Item)
      : undefined;
    let campusId = first ? (str(first, 'campus_id') ?? '') : '';
    const holds: Item[] = [];
    for (const ref of refs) {
      const booking = await this.table.get(ref.pk, ref.sk);
      if (!booking) {
        continue;
      }
      if (campusId === '') {
        campusId = str(booking, 'campus_id') ?? '';
      }
      holds.push({
        pk: ref.pk,
        sk: ref.sk,
        reservable_id: stripPrefix(ref.pk, 'RESERVABLE#'),
        reservable_name: str(booking, 'reservable_name') ?? '',
        reservable_type: str(booking, 'reservable_type') ?? '',
        schedule_selected: booking.schedule_selected ?? [],
      });
    }
    return { holds, campusId };
  }

  private async requireProponent(
    organizationId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item> {
    const item = await this.must(eventId, submissionId);
    if (stripPrefix(item.GSI1PK, 'ORGANIZATION#') !== organizationId) {
      throw new NotFoundException('Not Found');
    }
    return item;
  }

  private async requireReadable(
    organizationId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item> {
    const item = await this.must(eventId, submissionId);
    const owner = stripPrefix(item.GSI1PK, 'ORGANIZATION#');
    if (
      owner !== organizationId &&
      !dependentIds(item).includes(organizationId)
    ) {
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

  private view(item: Item, submission?: Item, includeSubmission = false): Item {
    const details = record(submission?.activity_details);
    return {
      change_id: stripPrefix(item.SK, 'RESERVATION_CHANGE#'),
      event_id: stripPrefix(item.PK, 'EVENT#'),
      submission_id: str(item, 'submission_id'),
      organization_id: str(item, 'organization_id'),
      campus_id: str(item, 'campus_id'),
      requested_by: stripPrefix(item.requested_by, 'STUDENT#'),
      requested_at: str(item, 'requested_at'),
      request_type: str(item, 'request_type'),
      reason: str(item, 'reason'),
      suggested_date: str(item, 'suggested_date'),
      status: str(item, 'status'),
      bookings: Array.isArray(item.bookings) ? item.bookings : [],
      decision: str(item, 'decision'),
      resolved_by: stripPrefix(item.resolved_by, 'SIGNATORY#'),
      resolved_at: str(item, 'resolved_at'),
      comment: str(item, 'comment'),
      ...(item.applied ? { applied: item.applied } : {}),
      ...(submission
        ? {
            event_title: details ? str(details, 'title_and_nature') : null,
            organization_name: str(submission, 'organization_name'),
          }
        : {}),
      ...(includeSubmission && submission ? { submission } : {}),
    };
  }
}

function deriveTiming(selections: Selection[]): Item {
  if (selections.length === 0) {
    return {};
  }
  const sorted = [...selections].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const first = sorted[0];
  if (!first) {
    return {};
  }
  const slots = [...first.slots].sort((left, right) => left - right);
  const start = slots[0];
  const end = slots[slots.length - 1];
  if (start === undefined || end === undefined) {
    return {};
  }
  const day = new Date(`${first.date}T12:00:00+08:00`).toLocaleDateString(
    'en-US',
    {
      weekday: 'long',
      timeZone: 'Asia/Manila',
    },
  );
  return {
    date_of_event: first.date,
    day_of_event: day,
    time_of_event: `${slotStart(start)} - ${slotEnd(end)}`,
  };
}
