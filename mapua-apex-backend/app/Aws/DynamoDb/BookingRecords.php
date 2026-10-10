<?php

namespace App\Aws\DynamoDb;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Shared slot-availability + booking engine used by BOTH the SAAF submission
 * write path and the CDM manual-reserve path, so a slot held by one is
 * unavailable to the other.
 *
 * Conflict detection runs on the base RESERVABLE partition (PK = RESERVABLE#id,
 * SK begins_with BOOKING#) — never on GSI5 — so it works before the (user-added)
 * organization index exists.
 */
final class BookingRecords
{
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
     *
     * @param  array<string, mixed>  $reservable
     * @return array{schedule: array<string, list<bool>>, dates: array<string, array{booked_slots: list<int>, available_slots: list<int>}>}
     */
    public function availabilityFor(array $reservable, string $start, string $end): array
    {
        $schedule = ReservableSchedule::normalize($reservable['schedule'] ?? []);
        $reservableId = DynamoKeys::strip($reservable['SK'] ?? null, 'RESERVABLE#') ?? '';
        $occupied = $this->occupiedSlots($reservableId, []);
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

            $dates[$date] = [
                'booked_slots' => array_values(array_map('intval', $bookedSlots)),
                'available_slots' => $available,
            ];
        }

        return ['schedule' => $schedule, 'dates' => $dates];
    }

    /**
     * Validate selections against the weekly template + existing bookings. Aborts
     * 409 on the first conflict, before anything is written.
     *
     * @param  array<string, mixed>  $reservable
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @param  list<string>  $excludeSks  booking sort keys to ignore (this submission's own holds)
     */
    public function assertAvailable(array $reservable, array $selections, array $excludeSks = []): void
    {
        $schedule = ReservableSchedule::normalize($reservable['schedule'] ?? []);
        $name = (string) ($reservable['name'] ?? 'This reservable');
        $reservableId = DynamoKeys::strip($reservable['SK'] ?? null, 'RESERVABLE#') ?? '';
        $occupied = $this->occupiedSlots($reservableId, $excludeSks);

        foreach ($selections as $selection) {
            $date = $selection['date'];

            if (ReservableSchedule::dayKeyForDate($date) === null) {
                abort(409, "{$name} cannot be reserved on {$date}.");
            }

            foreach ($selection['slots'] as $slot) {
                if (! ReservableSchedule::templateAllows($schedule, $date, $slot)) {
                    abort(409, "{$name} is not offered on {$date} at ".ReservableSchedule::slotLabel($slot).'.');
                }

                if (isset($occupied[$date][$slot])) {
                    abort(409, "{$name} is already booked on {$date} at ".ReservableSchedule::slotLabel($slot).'. Pick another time.');
                }
            }
        }
    }

    /**
     * Validate + build (without writing) the submission-sourced bookings for a
     * create/update. Returns the booking items to commit and the booking_refs to
     * persist on the submission. Nothing is written here, so a conflict aborts
     * before the submission is put.
     *
     * @param  array{organization_id: string, event_id: string, submission_id: string}  $context
     * @param  list<array<string, mixed>>  $reservations
     * @param  list<array<string, mixed>>  $oldRefs
     * @return array{refs: list<array{pk: string, sk: string}>, items: list<array<string, mixed>>}
     */
    public function planForSubmission(array $context, array $reservations, array $oldRefs = []): array
    {
        $excludeSks = $this->refSortKeys($oldRefs);
        $planned = [];

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

            $this->assertAvailable($reservable, $selections, $excludeSks);

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
                'campus_id' => (string) ($entry['reservation']['campus_id'] ?? ''),
                'reservable_name' => (string) ($entry['reservable']['name'] ?? ''),
                'reservable_type' => (string) ($entry['reservable']['type'] ?? ''),
                'event_id' => $context['event_id'],
                'submission_id' => $context['submission_id'],
                'organization_id' => $context['organization_id'],
            ];

            $items[] = $item;
            $refs[] = ['pk' => $pk, 'sk' => $sk];
        }

        return ['refs' => $refs, 'items' => $items];
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
     * date => (slot => true) for every booking under a reservable, skipping the
     * given booking sort keys.
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
            if (isset($exclude[(string) ($booking['SK'] ?? '')])) {
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
     * @param  mixed  $selections
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
