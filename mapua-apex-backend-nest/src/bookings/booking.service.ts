import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { dateRange, resolveWindow } from '../common/availability-window.js';
import {
  bookingKey,
  nowIso,
  organizationKey,
  reservableKey,
  stripPrefix,
} from '../common/dynamo-keys.js';
import { abort } from '../common/http.js';
import { num, str, type Item } from '../common/records.js';
import {
  ReservableRepository,
  toReservable,
} from '../reservables/reservable.repository.js';
import {
  capacityLabel,
  dayKeyForDate,
  normalizeSelections,
  slotLabel,
  templateAllows,
  withinCapacity,
  type Selection,
} from '../reservables/schedule.js';
import { BookingRepository } from './booking.repository.js';

export interface BookingConflict {
  reservable_id: string;
  reservable_name: string;
  date: string | null;
  slot: number | null;
  reason: 'taken' | 'not_offered' | 'capacity' | 'missing_reservable';
  message: string;
}

export interface BookingView {
  booking_id: string;
  reservable_id: string;
  reservable_name: string;
  reservable_type: string;
  campus_id: string | null;
  source: string | null;
  approval_status: 'approved' | 'pending';
  approved_at: string | null;
  approved_by: string | null;
  timestamp: string | null;
  schedule_selected: Selection[];
  reason: string | null;
  booked_by: string | null;
  organization_id: string | null;
  submission_id: string | null;
  event_id: string | null;
  quantity_requested: number | null;
}

export interface PlannedBooking {
  item: Item;
  ref: { pk: string; sk: string };
}

@Injectable()
export class BookingService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly reservables: ReservableRepository,
  ) {}

  async availability(
    campusId: string,
    reservableId: string,
    start?: string,
    end?: string,
  ): Promise<Item> {
    const item = await this.reservables.get(campusId, reservableId);
    if (!item) {
      abort(404, 'The selected room or equipment does not exist.');
    }
    const window = resolveWindow(start, end);
    const view = toReservable(item);
    const occupied = await this.occupiedSlots(view.reservable_id, new Set());
    const quantities =
      view.max_quantity !== null
        ? await this.bookedQuantities(view.reservable_id)
        : new Map<string, number>();
    const dates: Record<string, Item> = {};
    for (const date of dateRange(window.start, window.end)) {
      const booked = [...(occupied.get(date)?.values() ?? [])].sort(
        (a, b) => a - b,
      );
      const available: number[] = [];
      for (let slot = 0; slot < 12; slot += 1) {
        if (
          !booked.includes(slot) &&
          templateAllows(view.schedule, date, slot)
        ) {
          available.push(slot);
        }
      }
      const row: Item = { booked_slots: booked, available_slots: available };
      if (view.max_quantity !== null) {
        const bookedQuantity = quantities.get(date) ?? 0;
        row.booked_quantity = bookedQuantity;
        row.remaining_quantity = Math.max(
          0,
          view.max_quantity - bookedQuantity,
        );
      }
      dates[date] = row;
    }
    return {
      reservable_id: view.reservable_id,
      campus_id: view.campus_id,
      name: view.name,
      type: view.type,
      max_quantity: view.max_quantity,
      schedule: view.schedule,
      dates,
    };
  }

  async listInWindow(
    campusId: string,
    reservableId: string,
    start?: string,
    end?: string,
  ): Promise<BookingView[]> {
    const item = await this.reservables.get(campusId, reservableId);
    if (!item) {
      abort(404, 'The selected room or equipment does not exist.');
    }
    const window = resolveWindow(start, end);
    const rows = await this.bookings.list(reservableId);
    return rows
      .filter((row) =>
        selectionsOf(row).some(
          (selection) =>
            selection.date >= window.start && selection.date <= window.end,
        ),
      )
      .map((row) => toBooking(row));
  }

  async createManual(
    campusId: string,
    reservableId: string,
    selections: unknown,
    reason: string | undefined,
    bookedBy: string,
  ): Promise<BookingView> {
    const item = await this.reservables.get(campusId, reservableId);
    if (!item) {
      abort(404, 'The selected room or equipment does not exist.');
    }
    const normalized = normalizeSelections(selections);
    if (normalized.length === 0) {
      abort(422, 'Select at least one date and time slot.');
    }
    const conflicts = await this.collectConflicts(
      item,
      normalized,
      new Set(),
      null,
    );
    this.throwFirst(conflicts);
    const id = randomUUID();
    const stored: Item = {
      PK: reservableKey(reservableId),
      SK: bookingKey(id),
      timestamp: nowIso(),
      schedule_selected: normalized,
      source: 'cdm',
      campus_id: campusId,
      reservable_name: str(item, 'name'),
      reservable_type: str(item, 'type'),
      booked_by: bookedBy.startsWith('SIGNATORY#')
        ? bookedBy
        : `SIGNATORY#${bookedBy}`,
      ...(reason && reason.trim() !== '' ? { reason: reason.trim() } : {}),
    };
    await this.bookings.put(stored);
    return toBooking(stored);
  }

  async deleteManual(reservableId: string, bookingId: string): Promise<void> {
    const item = await this.bookings.get(reservableId, bookingId);
    if (!item) {
      abort(404, 'Not Found');
    }
    if (str(item, 'source') !== 'cdm') {
      abort(
        409,
        'Bookings created by a submission are released when it is denied or returned.',
      );
    }
    await this.bookings.delete(reservableId, bookingId);
  }

  async planForSubmission(input: PlanInput): Promise<PlannedBooking[]> {
    if (input.hasReservation !== true || input.reservations.length === 0) {
      return [];
    }
    this.assertEquipmentWithinRooms(input.reservations);
    const planned: PlannedBooking[] = [];
    for (const reservation of input.reservations) {
      if (!reservation.campus_id || !reservation.reservable_id) {
        abort(
          422,
          'Each reservation must reference a campus and a room or equipment.',
        );
      }
      const item = await this.reservables.get(
        reservation.campus_id,
        reservation.reservable_id,
      );
      if (!item) {
        abort(422, 'The selected room or equipment does not exist.');
      }
      const selections = normalizeSelections(reservation.selections);
      if (selections.length === 0) {
        abort(
          422,
          'Select at least one date and time slot for each reserved room or equipment.',
        );
      }
      const conflicts = await this.collectConflicts(
        item,
        selections,
        input.excludeSks,
        input.expectedParticipants,
      );
      this.throwFirst(conflicts);
      const id = randomUUID();
      const pk = reservableKey(reservation.reservable_id);
      const sk = bookingKey(id);
      const quantity =
        reservation.type === 'equipment'
          ? num(reservation as unknown as Item, 'quantity')
          : null;
      const stored: Item = {
        PK: pk,
        SK: sk,
        GSI5PK: organizationKey(input.organizationId),
        GSI5SK: nowIso(),
        timestamp: nowIso(),
        schedule_selected: selections,
        source: 'submission',
        approval_status: 'pending',
        campus_id: reservation.campus_id,
        reservable_name: str(item, 'name') ?? reservation.name,
        reservable_type: reservation.type,
        event_id: input.eventId,
        submission_id: input.submissionId,
        organization_id: input.organizationId,
        ...(quantity !== null ? { quantity_requested: quantity } : {}),
      };
      planned.push({ item: stored, ref: { pk, sk } });
    }
    return planned;
  }

  async commit(planned: PlannedBooking[]): Promise<void> {
    for (const row of planned) {
      await this.bookings.put(row.item);
    }
  }

  async releaseRefs(refs: { pk: string; sk: string }[]): Promise<void> {
    for (const ref of refs) {
      await this.bookings.deleteKey(ref.pk, ref.sk);
    }
  }

  async approveRefs(
    refs: { pk: string; sk: string }[],
    signatoryId: string,
  ): Promise<void> {
    const stamp = nowIso();
    for (const ref of refs) {
      await this.bookings.update(ref.pk, ref.sk, {
        approval_status: 'approved',
        approved_at: stamp,
        approved_by: signatoryId.startsWith('SIGNATORY#')
          ? signatoryId
          : `SIGNATORY#${signatoryId}`,
      });
    }
  }

  async conflictsForRefs(
    refs: { pk: string; sk: string }[],
    expectedParticipants: number | null,
  ): Promise<BookingConflict[]> {
    const conflicts: BookingConflict[] = [];
    const exclude = new Set(refs.map((ref) => ref.sk));
    for (const ref of refs) {
      const reservableId = stripPrefix(ref.pk, 'RESERVABLE#');
      const hold = await this.loadByKey(ref.pk, ref.sk);
      if (!hold || !reservableId) {
        conflicts.push({
          reservable_id: reservableId ?? '',
          reservable_name: 'This reservable',
          date: null,
          slot: null,
          reason: 'missing_reservable',
          message: 'This reservable no longer exists.',
        });
        continue;
      }
      const campusId = str(hold, 'campus_id') ?? '';
      const reservable = campusId
        ? await this.reservables.get(campusId, reservableId)
        : undefined;
      if (!reservable) {
        const name = str(hold, 'reservable_name') ?? 'This reservable';
        conflicts.push({
          reservable_id: reservableId,
          reservable_name: name,
          date: null,
          slot: null,
          reason: 'missing_reservable',
          message: `${name} no longer exists.`,
        });
        continue;
      }
      conflicts.push(
        ...(await this.collectConflicts(
          reservable,
          selectionsOf(hold),
          exclude,
          expectedParticipants,
        )),
      );
    }
    return conflicts;
  }

  async updateSchedule(
    pk: string,
    sk: string,
    selections: Selection[],
  ): Promise<void> {
    if (selections.length === 0) {
      abort(422, 'Select at least one date and time slot.');
    }
    await this.bookings.update(pk, sk, { schedule_selected: selections });
  }

  async createApprovedForSubmission(input: {
    reservable: Item;
    campusId: string;
    selections: Selection[];
    organizationId: string;
    eventId: string;
    submissionId: string;
    quantity?: number | null;
  }): Promise<{ pk: string; sk: string }> {
    const id = randomUUID();
    const pk = String(input.reservable.SK);
    const sk = bookingKey(id);
    await this.bookings.put({
      PK: pk,
      SK: sk,
      GSI5PK: organizationKey(input.organizationId),
      GSI5SK: nowIso(),
      timestamp: nowIso(),
      schedule_selected: input.selections,
      source: 'submission',
      approval_status: 'approved',
      approved_at: nowIso(),
      campus_id: input.campusId,
      reservable_name: str(input.reservable, 'name'),
      reservable_type: str(input.reservable, 'type'),
      event_id: input.eventId,
      submission_id: input.submissionId,
      organization_id: input.organizationId,
      ...(input.quantity != null ? { quantity_requested: input.quantity } : {}),
    });
    return { pk, sk };
  }

  async assertAvailable(
    reservable: Item,
    selections: Selection[],
    excludeSks: Set<string>,
    expectedParticipants: number | null,
  ): Promise<void> {
    const conflicts = await this.collectConflicts(
      reservable,
      selections,
      excludeSks,
      expectedParticipants,
    );
    this.throwFirst(conflicts);
  }

  async collectConflicts(
    reservable: Item,
    selections: Selection[],
    excludeSks: Set<string>,
    expectedParticipants: number | null,
  ): Promise<BookingConflict[]> {
    const view = toReservable(reservable);
    const conflicts: BookingConflict[] = [];
    if (
      expectedParticipants !== null &&
      !withinCapacity(
        view.type,
        expectedParticipants,
        view.min_participants,
        view.max_participants,
      )
    ) {
      const label =
        capacityLabel(view.min_participants, view.max_participants) ??
        'a limited capacity';
      conflicts.push({
        reservable_id: view.reservable_id,
        reservable_name: view.name,
        date: null,
        slot: null,
        reason: 'capacity',
        message: `${view.name} holds ${label}; the expected participants (${expectedParticipants}) fall outside it.`,
      });
    }
    const occupied = await this.occupiedSlots(view.reservable_id, excludeSks);
    for (const selection of selections) {
      if (!dayKeyForDate(selection.date)) {
        conflicts.push(
          this.conflict(
            view,
            selection.date,
            null,
            'not_offered',
            `${view.name} cannot be reserved on ${selection.date}.`,
          ),
        );
        continue;
      }
      for (const slot of selection.slots) {
        if (!templateAllows(view.schedule, selection.date, slot)) {
          conflicts.push(
            this.conflict(
              view,
              selection.date,
              slot,
              'not_offered',
              `${view.name} is not offered on ${selection.date} at ${slotLabel(slot)}.`,
            ),
          );
          continue;
        }
        if (occupied.get(selection.date)?.has(slot)) {
          conflicts.push(
            this.conflict(
              view,
              selection.date,
              slot,
              'taken',
              `${view.name} is already booked on ${selection.date} at ${slotLabel(slot)}. Pick another time.`,
            ),
          );
        }
      }
    }
    return conflicts;
  }

  private assertEquipmentWithinRooms(reservations: ReservationInput[]): void {
    const rooms = new Set<string>();
    for (const reservation of reservations) {
      if (reservation.type !== 'room') {
        continue;
      }
      for (const selection of normalizeSelections(reservation.selections)) {
        for (const slot of selection.slots) {
          rooms.add(`${selection.date}#${slot}`);
        }
      }
    }
    for (const reservation of reservations) {
      if (reservation.type !== 'equipment') {
        continue;
      }
      const name = reservation.name || 'This equipment';
      const selections = normalizeSelections(reservation.selections);
      if (rooms.size === 0) {
        abort(422, 'Reserve a room before adding equipment.');
      }
      for (const selection of selections) {
        for (const slot of selection.slots) {
          if (!rooms.has(`${selection.date}#${slot}`)) {
            abort(
              422,
              `Equipment '${name}' can only be reserved during your reserved room times.`,
            );
          }
        }
      }
    }
  }

  private async occupiedSlots(
    reservableId: string,
    excludeSks: Set<string>,
  ): Promise<Map<string, Set<number>>> {
    const occupied = new Map<string, Set<number>>();
    const rows = await this.bookings.list(reservableId);
    for (const row of rows) {
      if (excludeSks.has(String(row.SK)) || !isApproved(row)) {
        continue;
      }
      for (const selection of selectionsOf(row)) {
        const slots = occupied.get(selection.date) ?? new Set<number>();
        for (const slot of selection.slots) {
          slots.add(slot);
        }
        occupied.set(selection.date, slots);
      }
    }
    return occupied;
  }

  private async bookedQuantities(
    reservableId: string,
  ): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    const rows = await this.bookings.list(reservableId);
    for (const row of rows) {
      if (!isApproved(row)) {
        continue;
      }
      const quantity = num(row, 'quantity_requested') ?? 1;
      const dates = new Set(
        selectionsOf(row).map((selection) => selection.date),
      );
      for (const date of dates) {
        totals.set(date, (totals.get(date) ?? 0) + quantity);
      }
    }
    return totals;
  }

  private async loadByKey(pk: string, sk: string): Promise<Item | undefined> {
    const reservableId = stripPrefix(pk, 'RESERVABLE#');
    const bookingId = stripPrefix(sk, 'BOOKING#');
    if (!reservableId || !bookingId) {
      return undefined;
    }
    return this.bookings.get(reservableId, bookingId);
  }

  private throwFirst(conflicts: BookingConflict[]): void {
    const first = conflicts[0];
    if (!first) {
      return;
    }
    abort(first.reason === 'capacity' ? 422 : 409, first.message);
  }

  private conflict(
    view: { reservable_id: string; name: string },
    date: string | null,
    slot: number | null,
    reason: BookingConflict['reason'],
    message: string,
  ): BookingConflict {
    return {
      reservable_id: view.reservable_id,
      reservable_name: view.name || 'This reservable',
      date,
      slot,
      reason,
      message,
    };
  }
}

export interface ReservationInput {
  campus_id?: string;
  reservable_id?: string;
  name?: string;
  type?: string;
  selections?: unknown;
  remarks?: string;
}

export interface PlanInput {
  hasReservation: boolean;
  reservations: ReservationInput[];
  organizationId: string;
  eventId: string;
  submissionId: string;
  expectedParticipants: number | null;
  excludeSks: Set<string>;
}

function isApproved(item: Item): boolean {
  if (str(item, 'source') === 'cdm') {
    return true;
  }
  const status = str(item, 'approval_status');
  return status === null || status === 'approved';
}

function selectionsOf(item: Item): Selection[] {
  return normalizeSelections(item.schedule_selected);
}

export function toBooking(item: Item): BookingView {
  const approved = isApproved(item);
  return {
    booking_id: stripPrefix(item.SK, 'BOOKING#') ?? '',
    reservable_id: stripPrefix(item.PK, 'RESERVABLE#') ?? '',
    reservable_name: str(item, 'reservable_name') ?? '',
    reservable_type: str(item, 'reservable_type') ?? '',
    campus_id: str(item, 'campus_id'),
    source: str(item, 'source'),
    approval_status: approved ? 'approved' : 'pending',
    approved_at: str(item, 'approved_at'),
    approved_by: stripPrefix(item.approved_by, 'SIGNATORY#'),
    timestamp: str(item, 'timestamp'),
    schedule_selected: selectionsOf(item),
    reason: str(item, 'reason'),
    booked_by: stripPrefix(item.booked_by, 'SIGNATORY#'),
    organization_id: stripPrefix(
      item.organization_id ?? item.GSI5PK,
      'ORGANIZATION#',
    ),
    submission_id: str(item, 'submission_id'),
    event_id: str(item, 'event_id'),
    quantity_requested: num(item, 'quantity_requested'),
  };
}
