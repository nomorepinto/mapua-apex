<?php

namespace App\Aws\DynamoDb;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Shared slot-availability + booking engine used by BOTH the SAAF submission
 * write path and the CDM manual-reserve path, so a slot held by one is
 * unavailable to the other.
 *
 * SAAF holds are written `approval_status: pending` and only occupy slots once
 * the CDM desk approves the submission (see isApproved).
 *
 * Conflict detection runs on the base RESERVABLE partition (PK = RESERVABLE#id,
 * SK begins_with BOOKING#) — never on GSI5 — so it works before the (user-added)
 * organization index exists.
 */
final class BookingRecords
{
    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    /**
     * Hard cap on the number of days an availability window will expand to.
     */
    private const MAX_RANGE_DAYS = 366;

    public function __construct(private DynamoDbItems $items) {}

    /**
     * Raw booking items under a reservable, optionally filtered to those touching
     * any date in [start, end].
     *
     * @return list<array<string, mixed>>
     */
    public function listBookings(string $reservableId, ?string $start = null, ?string $end = null): array
    {
        $bookings = $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::reservable($reservableId)],
                ':sk' => ['S' => 'BOOKING#'],
            ],
        ]);

        if ($start === null || $end === null) {
            return $bookings;
        }

        $range = $this->dateRange($start, $end);
        $rangeSet = array_fill_keys($range, true);
        $filtered = [];

        foreach ($bookings as $booking) {
            foreach ($this->selections($booking) as $selection) {
                if (isset($rangeSet[$selection['date']])) {
                    $filtered[] = $booking;
                    break;
                }
            }
        }

        return $filtered;
    }

    /**
     * Effective availability for a reservable across [start, end]: per date, the
     * booked slots and the still-free slots (weekly template minus bookings).
     * For equipment with a max_quantity, also returns booked_quantity and
     * remaining_quantity per date.
     *
     * @param  array<string, mixed>  $reservable
     * @return array{schedule: array<string, list<bool>>, dates: array<string, array{booked_slots: list<int>, available_slots: list<int>}>}
     */
    public function availabilityFor(array $reservable, string $start, string $end): array
    {
        $schedule = ReservableSchedule::normalize($reservable['schedule'] ?? []);
        $reservableId = DynamoKeys::strip($reservable['SK'] ?? null, 'RESERVABLE#') ?? '';
        $isEquipment = ($reservable['type'] ?? null) === 'equipment';
        $maxQuantity = $isEquipment && is_numeric($reservable['max_quantity'] ?? null)
            ? (int) $reservable['max_quantity']
            : null;
        $occupied = $this->occupiedSlots($reservableId, []);
        $bookedQuantities = $maxQuantity !== null
            ? $this->bookedQuantitiesByDate($reservableId)
            : [];
        $dates = [];

        foreach ($this->dateRange($start, $end) as $date) {
            $booked = $occupied[$date] ?? [];
            $bookedSlots = array_keys($booked);
            sort($bookedSlots);

            $available = [];

            for ($slot = 0; $slot < ReservableSchedule::SLOTS; $slot++) {
                if (! isset($booked[$slot]) && ReservableSchedule::templateAllows($schedule, $date, $slot)) {
                    $available[] = $slot;
                }
            }

            $entry = [
                'booked_slots' => array_values(array_map('intval', $bookedSlots)),
                'available_slots' => $available,
            ];

            if ($maxQuantity !== null) {
                $bookedQty = $bookedQuantities[$date] ?? 0;
                $entry['booked_quantity'] = $bookedQty;
                $entry['remaining_quantity'] = max(0, $maxQuantity - $bookedQty);
            }

            $dates[$date] = $entry;
        }

        return ['schedule' => $schedule, 'dates' => $dates, 'max_quantity' => $maxQuantity];
    }

    /**
     * Validate selections against the weekly template + existing bookings, plus
     * the room's participant bounds against the expected headcount when one is
     * known. Aborts 409 on the first conflict, before anything is written.
     *
     * @param  array<string, mixed>  $reservable
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @param  list<string>  $excludeSks  booking sort keys to ignore (this submission's own holds)
     */
    public function assertAvailable(array $reservable, array $selections, array $excludeSks = [], ?int $expectedParticipants = null): void
    {
        $conflict = $this->collectConflicts($reservable, $selections, $excludeSks, $expectedParticipants)[0] ?? null;

        if ($conflict !== null) {
            abort($conflict['reason'] === 'capacity' ? 422 : 409, $conflict['message']);
        }
    }

    /**
     * Every conflict between a submission's own holds and the reservables'
     * current approved bookings, without aborting. Feeds the CDM review warning
     * and the approval-time guard.
     *
     * @param  list<array<string, mixed>>  $refs
     * @return list<array{reservable_id: string, reservable_name: string, date: string|null, slot: int|null, reason: string, message: string}>
     */
    public function conflictsForRefs(array $refs, ?int $expectedParticipants = null): array
    {
        $excludeSks = $this->refSortKeys($refs);
        $conflicts = [];

        foreach ($refs as $ref) {
            $pk = is_array($ref) ? ($ref['pk'] ?? null) : null;
            $sk = is_array($ref) ? ($ref['sk'] ?? null) : null;

            if (! is_string($pk) || $pk === '' || ! is_string($sk) || $sk === '') {
                continue;
            }

            $booking = $this->items->get($pk, $sk);

            if ($booking === null) {
                continue;
            }

            $reservableId = DynamoKeys::strip($pk, 'RESERVABLE#') ?? '';
            $name = (string) ($booking['reservable_name'] ?? 'This reservable');
            $campusId = (string) ($booking['campus_id'] ?? '');
            $reservable = $campusId !== ''
                ? $this->items->get(DynamoKeys::campus($campusId), DynamoKeys::reservable($reservableId))
                : null;

            if ($reservable === null) {
                $conflicts[] = [
                    'reservable_id' => $reservableId,
                    'reservable_name' => $name,
                    'date' => null,
                    'slot' => null,
                    'reason' => 'missing_reservable',
                    'message' => "{$name} no longer exists.",
                ];

                continue;
            }

            array_push($conflicts, ...$this->collectConflicts(
                $reservable,
                $this->selections($booking),
                $excludeSks,
                $expectedParticipants,
            ));
        }

        return $conflicts;
    }

    /**
     * Mark a submission's pending holds approved so they start counting toward
     * availability. Refs whose booking no longer exists are skipped.
     *
     * @param  list<array<string, mixed>>  $refs
     */
    public function approveRefs(array $refs, string $signatoryId): void
    {
        $timestamp = DynamoKeys::now();

        foreach ($refs as $ref) {
            $pk = is_array($ref) ? ($ref['pk'] ?? null) : null;
            $sk = is_array($ref) ? ($ref['sk'] ?? null) : null;

            if (! is_string($pk) || $pk === '' || ! is_string($sk) || $sk === '') {
                continue;
            }

            $booking = $this->items->get($pk, $sk);

            if ($booking === null || ($booking['approval_status'] ?? null) !== self::PENDING) {
                continue;
            }

            $this->items->patch($pk, $sk, [
                'approval_status' => self::APPROVED,
                'approved_at' => $timestamp,
                'approved_by' => DynamoKeys::signatory($signatoryId),
            ]);
        }
    }

    /**
     * Whether a booking occupies its slots. Manual CDM holds and legacy items
     * without approval_status always count; submission holds count once approved.
     *
     * @param  array<string, mixed>  $booking
     */
    public static function isApproved(array $booking): bool
    {
        if (($booking['source'] ?? null) === 'cdm') {
            return true;
        }

        $status = $booking['approval_status'] ?? null;

        return $status === null || $status === self::APPROVED;
    }

    /**
     * @param  array<string, mixed>  $reservable
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @param  list<string>  $excludeSks
     * @return list<array{reservable_id: string, reservable_name: string, date: string|null, slot: int|null, reason: string, message: string}>
     */
    private function collectConflicts(array $reservable, array $selections, array $excludeSks, ?int $expectedParticipants): array
    {
        $schedule = ReservableSchedule::normalize($reservable['schedule'] ?? []);
        $name = (string) ($reservable['name'] ?? 'This reservable');
        $reservableId = DynamoKeys::strip($reservable['SK'] ?? null, 'RESERVABLE#') ?? '';
        $conflict = static fn (?string $date, ?int $slot, string $reason, string $message): array => [
            'reservable_id' => $reservableId,
            'reservable_name' => $name,
            'date' => $date,
            'slot' => $slot,
            'reason' => $reason,
            'message' => $message,
        ];

        if (! ReservableSchedule::withinCapacity($reservable, $expectedParticipants)) {
            $label = ReservableSchedule::capacityLabel($reservable);

            return [$conflict(null, null, 'capacity', "{$name} holds {$label}; the expected participants ({$expectedParticipants}) fall outside it.")];
        }

        $occupied = $this->occupiedSlots($reservableId, $excludeSks);
        $conflicts = [];

        foreach ($selections as $selection) {
            $date = $selection['date'];

            if (ReservableSchedule::dayKeyForDate($date) === null) {
                $conflicts[] = $conflict($date, null, 'not_offered', "{$name} cannot be reserved on {$date}.");

                continue;
            }

            foreach ($selection['slots'] as $slot) {
                if (! ReservableSchedule::templateAllows($schedule, $date, $slot)) {
                    $conflicts[] = $conflict($date, $slot, 'not_offered', "{$name} is not offered on {$date} at ".ReservableSchedule::slotLabel($slot).'.');
                } elseif (isset($occupied[$date][$slot])) {
                    $conflicts[] = $conflict($date, $slot, 'taken', "{$name} is already booked on {$date} at ".ReservableSchedule::slotLabel($slot).'. Pick another time.');
                }
            }
        }

        return $conflicts;
    }

    /**
     * Validate + build (without writing) the submission-sourced bookings for a
     * create/update. Returns the booking items to commit and the booking_refs to
     * persist on the submission. Nothing is written here, so a conflict aborts
     * before the submission is put.
     *
     * @param  array{organization_id: string, event_id: string, submission_id: string, expected_participants?: int|null}  $context
     * @param  list<array<string, mixed>>  $reservations
     * @param  list<array<string, mixed>>  $oldRefs
     * @return array{refs: list<array{pk: string, sk: string}>, items: list<array<string, mixed>>}
     */
    public function planForSubmission(array $context, array $reservations, array $oldRefs = []): array
    {
        $excludeSks = $this->refSortKeys($oldRefs);
        $expectedParticipants = isset($context['expected_participants']) && is_numeric($context['expected_participants'])
            ? (int) $context['expected_participants']
            : null;
        $planned = [];

        $this->assertEquipmentWithinRooms($reservations);

        foreach ($reservations as $reservation) {
            if (! is_array($reservation)) {
                continue;
            }

            $campusId = (string) ($reservation['campus_id'] ?? '');
            $reservableId = DynamoKeys::strip($reservation['reservable_id'] ?? null, 'RESERVABLE#');

            if ($campusId === '' || $reservableId === null || $reservableId === '') {
                abort(422, 'Each reservation must reference a campus and a room or equipment.');
            }

            $reservable = $this->items->get(DynamoKeys::campus($campusId), DynamoKeys::reservable($reservableId));

            if ($reservable === null) {
                abort(422, 'The selected room or equipment does not exist.');
            }

            $selections = $this->normalizeSelections($reservation['selections'] ?? []);

            if ($selections === []) {
                abort(422, 'Select at least one date and time slot for each reserved room or equipment.');
            }

            $this->assertAvailable($reservable, $selections, $excludeSks, $expectedParticipants);

            $planned[] = ['reservable' => $reservable, 'reservation' => $reservation, 'selections' => $selections];
        }

        $timestamp = DynamoKeys::now();
        $items = [];
        $refs = [];

        foreach ($planned as $entry) {
            $bookingId = (string) Str::uuid();
            $pk = DynamoKeys::reservable($this->reservableId($entry['reservable']));
            $sk = DynamoKeys::booking($bookingId);

            $item = [
                'PK' => $pk,
                'SK' => $sk,
                'GSI5PK' => DynamoKeys::organizationIndex($context['organization_id']),
                'GSI5SK' => $timestamp,
                'timestamp' => $timestamp,
                'schedule_selected' => $entry['selections'],
                'source' => 'submission',
                'approval_status' => self::PENDING,
                'campus_id' => (string) ($entry['reservation']['campus_id'] ?? ''),
                'reservable_name' => (string) ($entry['reservable']['name'] ?? ''),
                'reservable_type' => (string) ($entry['reservable']['type'] ?? ''),
                'event_id' => $context['event_id'],
                'submission_id' => $context['submission_id'],
                'organization_id' => $context['organization_id'],
            ];

            // Store the requested unit count for equipment bookings.
            $quantityRequested = $entry['reservation']['quantity_requested'] ?? null;

            if (($entry['reservable']['type'] ?? null) === 'equipment' && is_numeric($quantityRequested)) {
                $item['quantity_requested'] = (int) $quantityRequested;
            }

            $items[] = $item;
            $refs[] = ['pk' => $pk, 'sk' => $sk];
        }

        return ['refs' => $refs, 'items' => $items];
    }

    /**
     * Enforce the SAAF reservation rule that equipment may only be held while a
     * room is reserved, and only on dates/slots some reserved room already covers
     * (union of all rooms). Runs validate-first (before any write) so a violation
     * aborts 422 with nothing persisted. CDM manual holds (createManual) are
     * intentionally exempt.
     *
     * @param  list<array<string, mixed>>  $reservations
     */
    private function assertEquipmentWithinRooms(array $reservations): void
    {
        $roomCoverage = [];

        foreach ($reservations as $reservation) {
            if (! is_array($reservation) || ($reservation['type'] ?? null) !== 'room') {
                continue;
            }

            foreach ($this->normalizeSelections($reservation['selections'] ?? []) as $selection) {
                foreach ($selection['slots'] as $slot) {
                    $roomCoverage[$selection['date']][$slot] = true;
                }
            }
        }

        foreach ($reservations as $reservation) {
            if (! is_array($reservation) || ($reservation['type'] ?? null) !== 'equipment') {
                continue;
            }

            $name = (string) ($reservation['name'] ?? 'This equipment');

            if ($roomCoverage === []) {
                abort(422, 'Reserve a room before adding equipment.');
            }

            foreach ($this->normalizeSelections($reservation['selections'] ?? []) as $selection) {
                foreach ($selection['slots'] as $slot) {
                    if (! isset($roomCoverage[$selection['date']][$slot])) {
                        abort(422, "Equipment '{$name}' can only be reserved during your reserved room times.");
                    }
                }
            }
        }
    }

    /**
     * Write previously planned booking items.
     *
     * @param  list<array<string, mixed>>  $items
     */
    public function commit(array $items): void
    {
        foreach ($items as $item) {
            $this->items->put($item);
        }
    }

    /**
     * CDM manual hold. Validates then writes immediately; carries no submission
     * linkage and no GSI5, so it never appears in an organization's booking list.
     *
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @return array<string, mixed>
     */
    public function createManual(
        string $campusId,
        string $reservableId,
        array $selections,
        string $bookedBy,
        ?string $reason = null,
    ): array {
        $reservableId = DynamoKeys::strip($reservableId, 'RESERVABLE#') ?? $reservableId;
        $reservable = $this->items->get(DynamoKeys::campus($campusId), DynamoKeys::reservable($reservableId));

        if ($reservable === null) {
            abort(404, 'The selected room or equipment does not exist.');
        }

        $normalized = $this->normalizeSelections($selections);

        if ($normalized === []) {
            abort(422, 'Select at least one date and time slot.');
        }

        $this->assertAvailable($reservable, $normalized, []);

        $timestamp = DynamoKeys::now();
        $pk = DynamoKeys::reservable($reservableId);
        $sk = DynamoKeys::booking((string) Str::uuid());

        $item = [
            'PK' => $pk,
            'SK' => $sk,
            'timestamp' => $timestamp,
            'schedule_selected' => $normalized,
            'source' => 'cdm',
            'campus_id' => $campusId,
            'reservable_name' => (string) ($reservable['name'] ?? ''),
            'reservable_type' => (string) ($reservable['type'] ?? ''),
            'booked_by' => DynamoKeys::signatory($bookedBy),
        ];

        $reason = is_string($reason) ? trim($reason) : '';

        if ($reason !== '') {
            $item['reason'] = $reason;
        }

        $this->items->put($item);

        return $item;
    }

    /**
     * Release a single manual (source:cdm) booking. Submission holds are refused
     * so a live paper's reservation is never deleted out from under it.
     */
    public function deleteBooking(string $reservableId, string $bookingId): void
    {
        $pk = DynamoKeys::reservable($reservableId);
        $sk = DynamoKeys::booking($bookingId);
        $item = $this->items->get($pk, $sk);

        if ($item === null) {
            abort(404);
        }

        if (($item['source'] ?? null) !== 'cdm') {
            abort(409, 'Bookings created by a submission are released when it is denied or returned.');
        }

        $this->items->delete($pk, $sk);
    }

    /**
     * Public selector normalization so callers (reservation-change resolution)
     * validate and store the exact canonical {date, slots} shape.
     *
     * @return list<array{date: string, slots: list<int>}>
     */
    public function normalize(mixed $selections): array
    {
        return $this->normalizeSelections($selections);
    }

    /**
     * In-place schedule edit of an existing booking (same PK/SK). Keys, source,
     * GSI5 linkage and the submission pointers survive untouched, so the owning
     * SUBMISSION's booking_refs entry stays valid as-is.
     *
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @return array<string, mixed>
     */
    public function updateSchedule(string $pk, string $sk, array $selections): array
    {
        $normalized = $this->normalizeSelections($selections);

        if ($normalized === []) {
            abort(422, 'Select at least one date and time slot.');
        }

        $this->items->patch($pk, $sk, ['schedule_selected' => $normalized]);

        return $this->items->get($pk, $sk) ?? [
            'PK' => $pk,
            'SK' => $sk,
            'schedule_selected' => $normalized,
        ];
    }

    /**
     * Create a single submission-sourced booking (with GSI5 linkage) under a
     * reservable. Used by reservation-change resolution when a hold is swapped
     * onto a different room/equipment.
     *
     * @param  array{organization_id: string, event_id: string, submission_id: string, campus_id?: string}  $context
     * @param  array<string, mixed>  $reservable
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @return array<string, mixed>
     */
    public function createForSubmission(array $context, array $reservable, array $selections): array
    {
        $normalized = $this->normalizeSelections($selections);

        if ($normalized === []) {
            abort(422, 'Select at least one date and time slot.');
        }

        $timestamp = DynamoKeys::now();
        $item = [
            'PK' => DynamoKeys::reservable($this->reservableId($reservable)),
            'SK' => DynamoKeys::booking((string) Str::uuid()),
            'GSI5PK' => DynamoKeys::organizationIndex($context['organization_id']),
            'GSI5SK' => $timestamp,
            'timestamp' => $timestamp,
            'schedule_selected' => $normalized,
            'source' => 'submission',
            'approval_status' => self::APPROVED,
            'approved_at' => $timestamp,
            'campus_id' => (string) ($context['campus_id'] ?? ''),
            'reservable_name' => (string) ($reservable['name'] ?? ''),
            'reservable_type' => (string) ($reservable['type'] ?? ''),
            'event_id' => $context['event_id'],
            'submission_id' => $context['submission_id'],
            'organization_id' => $context['organization_id'],
        ];

        $this->items->put($item);

        return $item;
    }

    /**
     * Delete every booking referenced by a submission's booking_refs.
     *
     * @param  list<array<string, mixed>>  $refs
     */
    public function releaseRefs(array $refs): void
    {
        foreach ($refs as $ref) {
            if (! is_array($ref)) {
                continue;
            }

            $pk = $ref['pk'] ?? null;
            $sk = $ref['sk'] ?? null;

            if (is_string($pk) && $pk !== '' && is_string($sk) && $sk !== '') {
                $this->items->delete($pk, $sk);
            }
        }
    }

    /**
     * date => (slot => true) for every approved booking under a reservable,
     * skipping the given booking sort keys.
     *
     * @param  list<string>  $excludeSks
     * @return array<string, array<int, true>>
     */
    private function occupiedSlots(string $reservableId, array $excludeSks): array
    {
        $exclude = array_fill_keys($excludeSks, true);
        $bookings = $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::reservable($reservableId)],
                ':sk' => ['S' => 'BOOKING#'],
            ],
        ]);

        $occupied = [];

        foreach ($bookings as $booking) {
            if (isset($exclude[(string) ($booking['SK'] ?? '')]) || ! self::isApproved($booking)) {
                continue;
            }

            foreach ($this->selections($booking) as $selection) {
                foreach ($selection['slots'] as $slot) {
                    $occupied[$selection['date']][$slot] = true;
                }
            }
        }

        return $occupied;
    }

    /**
     * Sum of quantity_requested across all approved bookings under a reservable,
     * keyed by date. Used to compute remaining_quantity for equipment with a max_quantity.
     *
     * @return array<string, int>  date => total units booked
     */
    private function bookedQuantitiesByDate(string $reservableId): array
    {
        $bookings = $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::reservable($reservableId)],
                ':sk' => ['S' => 'BOOKING#'],
            ],
        ]);

        $quantities = [];

        foreach ($bookings as $booking) {
            if (! self::isApproved($booking)) {
                continue;
            }

            $qty = is_numeric($booking['quantity_requested'] ?? null) ? (int) $booking['quantity_requested'] : 1;

            foreach ($this->selections($booking) as $selection) {
                $quantities[$selection['date']] = ($quantities[$selection['date']] ?? 0) + $qty;
            }
        }

        return $quantities;
    }

    /**
     * Read a booking's schedule_selected into normalized {date, slots} pairs.
     *
     * @param  array<string, mixed>  $booking
     * @return list<array{date: string, slots: list<int>}>
     */
    private function selections(array $booking): array
    {
        return $this->normalizeSelections($booking['schedule_selected'] ?? []);
    }

    /**
     * Coerce raw selections into normalized {date: Y-m-d, slots: sorted unique ints}.
     *
     * @return list<array{date: string, slots: list<int>}>
     */
    private function normalizeSelections(mixed $selections): array
    {
        $list = is_array($selections) ? $selections : [];
        $byDate = [];

        foreach ($list as $selection) {
            if (! is_array($selection)) {
                continue;
            }

            $date = $selection['date'] ?? null;

            if (! is_string($date) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) !== 1) {
                continue;
            }

            $rawSlots = $selection['slots'] ?? [];
            $slots = $byDate[$date] ?? [];

            foreach (is_array($rawSlots) ? $rawSlots : [] as $slot) {
                $slot = is_string($slot) && ctype_digit($slot) ? (int) $slot : $slot;

                if (ReservableSchedule::isValidSlot($slot)) {
                    $slots[(int) $slot] = true;
                }
            }

            if ($slots !== []) {
                $byDate[$date] = $slots;
            }
        }

        $normalized = [];

        foreach ($byDate as $date => $slots) {
            $slotList = array_map('intval', array_keys($slots));
            sort($slotList);
            $normalized[] = ['date' => (string) $date, 'slots' => $slotList];
        }

        usort($normalized, static fn (array $a, array $b): int => strcmp($a['date'], $b['date']));

        return $normalized;
    }

    /**
     * @param  list<array<string, mixed>>  $refs
     * @return list<string>
     */
    private function refSortKeys(array $refs): array
    {
        $keys = [];

        foreach ($refs as $ref) {
            $sk = is_array($ref) ? ($ref['sk'] ?? null) : null;

            if (is_string($sk) && $sk !== '') {
                $keys[] = $sk;
            }
        }

        return $keys;
    }

    /**
     * @param  array<string, mixed>  $reservable
     */
    private function reservableId(array $reservable): string
    {
        return DynamoKeys::strip($reservable['SK'] ?? null, 'RESERVABLE#') ?? '';
    }

    /**
     * Inclusive list of Y-m-d dates from start to end (clamped to MAX_RANGE_DAYS).
     *
     * @return list<string>
     */
    private function dateRange(string $start, string $end): array
    {
        try {
            $cursor = CarbonImmutable::parse($start)->startOfDay();
            $last = CarbonImmutable::parse($end)->startOfDay();
        } catch (\Throwable) {
            return [];
        }

        if ($last < $cursor) {
            return [];
        }

        $cap = $cursor->addDays(self::MAX_RANGE_DAYS);

        if ($last > $cap) {
            $last = $cap;
        }

        $dates = [];

        while ($cursor <= $last) {
            $dates[] = $cursor->toDateString();
            $cursor = $cursor->addDay();
        }

        return $dates;
    }
}
