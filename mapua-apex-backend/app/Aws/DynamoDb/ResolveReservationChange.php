<?php

namespace App\Aws\DynamoDb;

use Carbon\CarbonImmutable;

/**
 * Applies a CDM decision to a pending RESERVATION_CHANGE.
 *
 * Three outcomes:
 *   cancel     — release every linked BOOKING, flip the SUBMISSION to the
 *                terminal "cancelled" status, drop booking_refs.
 *   reschedule — edit the targeted BOOKINGs in place (date/slot change) or
 *                release-and-recreate them (room swap), then rewrite the
 *                paper's venue_reservation, booking_refs and event date/time.
 *   deny       — leave the paper and its holds untouched.
 *
 * Every outcome keeps SUBMISSION.booking_refs in lockstep with the live holds
 * and records a before/after `applied` audit trail on the change item.
 */
final class ResolveReservationChange
{
    public function __construct(
        private DynamoDbItems $items,
        private GetSubmission $submissions,
        private BookingRecords $bookings,
        private ReservableRecords $reservables,
        private NotificationRecords $notifications,
        private ReservationChangeRecords $changes,
    ) {}

    /**
     * @param  array<string, mixed>  $input  validated resolve payload
     * @return array<string, mixed>  the finalized change item
     */
    public function handle(string $campusId, string $changeId, string $signatoryId, array $input): array
    {
        $change = $this->changes->findForCampus($campusId, $changeId);

        if ($change === null) {
            abort(404);
        }

        if (($change['status'] ?? null) !== 'pending') {
            abort(409, 'This reservation change has already been resolved.');
        }

        $eventId = (string) (DynamoKeys::strip($change['PK'] ?? null, 'EVENT#') ?? '');
        $submissionId = (string) ($change['submission_id'] ?? '');
        $submission = $this->submissions->require($eventId, $submissionId);

        if (($submission['status'] ?? null) !== 'approved') {
            abort(409, 'Only an approved submission\'s reservation can be changed.');
        }

        $decision = (string) ($input['decision'] ?? '');
        $comment = trim((string) ($input['comment'] ?? ''));

        $resolved = match ($decision) {
            'cancel' => $this->cancel($change, $submission, $eventId, $submissionId, $signatoryId, $comment),
            'reschedule' => $this->reschedule($change, $submission, $eventId, $submissionId, $signatoryId, $comment, $input),
            'deny' => $this->deny($change, $submission, $submissionId, $signatoryId, $comment),
            default => abort(422, 'Unknown reservation change decision.'),
        };

        return $resolved;
    }

    /**
     * @param  array<string, mixed>  $change
     * @param  array<string, mixed>  $submission
     * @return array<string, mixed>
     */
    private function cancel(array $change, array $submission, string $eventId, string $submissionId, string $signatoryId, string $comment): array
    {
        $liveRefs = $this->liveRefs($submission);

        // Release the holds first, then flip the paper — the same order the
        // deny/return paths use, so a slot is never orphaned.
        $this->bookings->releaseRefs($liveRefs);

        $appliedBookings = [];

        foreach ($this->snapshot($change) as $hold) {
            $appliedBookings[] = [
                'pk' => $hold['pk'],
                'sk' => $hold['sk'],
                'action' => 'released',
                'before' => [
                    'reservable_id' => $hold['reservable_id'],
                    'schedule_selected' => $hold['schedule_selected'],
                ],
                'after' => null,
            ];
        }

        $this->items->patch(
            DynamoKeys::event($eventId),
            DynamoKeys::submission($submissionId),
            ['status' => 'cancelled'],
            ['booking_refs'],
        );

        $submission['status'] = 'cancelled';
        unset($submission['booking_refs']);

        $applied = [
            'bookings' => $appliedBookings,
            'submission' => [
                'status_before' => 'approved',
                'status_after' => 'cancelled',
                'booking_refs_before' => $liveRefs,
                'booking_refs_after' => [],
            ],
        ];

        $this->notifications->create(
            $submissionId,
            $signatoryId,
            'reservation cancelled',
            $comment !== '' ? $comment : 'Your event reservation was cancelled.',
            submission: $submission,
        );

        return $this->changes->finalize($change, [
            'decision' => 'cancel',
            'resolved_by' => DynamoKeys::signatory($signatoryId),
            'resolved_at' => DynamoKeys::now(),
            'comment' => $comment,
            'applied' => $applied,
            'status' => 'resolved',
        ]);
    }

    /**
     * @param  array<string, mixed>  $change
     * @param  array<string, mixed>  $submission
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function reschedule(array $change, array $submission, string $eventId, string $submissionId, string $signatoryId, string $comment, array $input): array
    {
        $snapshot = $this->snapshot($change);

        if ($snapshot === []) {
            abort(409, 'This reservation change no longer references any live booking.');
        }

        $liveRefs = $this->liveRefs($submission);
        $liveKeys = [];

        foreach ($liveRefs as $ref) {
            $liveKeys[$this->refKey((string) ($ref['pk'] ?? ''), (string) ($ref['sk'] ?? ''))] = true;
        }

        // Staleness guard: every snapshotted hold must still be linked to the
        // paper. If the holds shifted, the request is stale and must be re-made.
        foreach ($snapshot as $hold) {
            if (! isset($liveKeys[$this->refKey($hold['pk'], $hold['sk'])])) {
                abort(409, 'The reservation changed since this request was made. Deny it and ask the student to request again.');
            }
        }

        $instructions = $this->instructionsByRef($input['bookings'] ?? []);
        $excludeSks = array_values(array_filter(array_map(
            static fn (array $ref): ?string => is_string($ref['sk'] ?? null) ? $ref['sk'] : null,
            $liveRefs,
        )));
        $expectedParticipants = is_numeric(data_get($submission, 'activity_details.expected_participants'))
            ? (int) data_get($submission, 'activity_details.expected_participants')
            : null;
        $organizationId = (string) ($change['organization_id'] ?? '');
        $campusId = (string) ($change['campus_id'] ?? '');

        $context = [
            'organization_id' => $organizationId,
            'event_id' => $eventId,
            'submission_id' => $submissionId,
            'campus_id' => $campusId,
        ];

        // Plan + validate every hold up front so a conflict aborts with zero writes.
        $plan = [];

        foreach ($snapshot as $hold) {
            $instruction = $instructions[$this->refKey($hold['pk'], $hold['sk'])] ?? ['action' => 'keep'];
            $action = (string) ($instruction['action'] ?? 'keep');

            if ($action === 'keep') {
                $plan[] = ['hold' => $hold, 'action' => 'keep', 'selections' => $hold['schedule_selected']];
                continue;
            }

            $selections = $this->bookings->normalize($instruction['selections'] ?? []);

            if ($selections === []) {
                abort(422, 'Select at least one date and time slot for each changed hold.');
            }

            if ($action === 'swap') {
                $newReservableId = DynamoKeys::strip($instruction['new_reservable_id'] ?? null, 'RESERVABLE#');

                if ($newReservableId === null || $newReservableId === '') {
                    abort(422, 'A room swap must name the new room or equipment.');
                }

                $reservable = $this->reservables->require($campusId, $newReservableId);
                $this->bookings->assertAvailable($reservable, $selections, $excludeSks, $expectedParticipants);
                $plan[] = ['hold' => $hold, 'action' => 'swap', 'selections' => $selections, 'reservable' => $reservable];
                continue;
            }

            // action === 'update' — same reservable, new date/slots.
            $reservable = $this->reservables->require($campusId, $hold['reservable_id']);
            $this->bookings->assertAvailable($reservable, $selections, $excludeSks, $expectedParticipants);
            $plan[] = ['hold' => $hold, 'action' => 'update', 'selections' => $selections, 'reservable' => $reservable];
        }

        // Apply: bookings first, then a single submission rewrite.
        $appliedBookings = [];
        $newRefs = [];
        $reservations = [];
        $allSelections = [];
        $remarksByReservable = $this->remarksByReservable($submission);

        foreach ($plan as $entry) {
            $hold = $entry['hold'];
            $action = $entry['action'];
            $selections = $entry['selections'];
            $allSelections = array_merge($allSelections, $selections);

            if ($action === 'keep') {
                $newRefs[] = ['pk' => $hold['pk'], 'sk' => $hold['sk']];
                $reservations[] = $this->reservationEntry($hold['reservable_id'], $campusId, $hold['reservable_name'], $hold['reservable_type'], $selections, $remarksByReservable);
                $appliedBookings[] = [
                    'pk' => $hold['pk'],
                    'sk' => $hold['sk'],
                    'action' => 'kept',
                    'before' => ['reservable_id' => $hold['reservable_id'], 'schedule_selected' => $hold['schedule_selected']],
                    'after' => ['reservable_id' => $hold['reservable_id'], 'schedule_selected' => $selections],
                ];
                continue;
            }

            if ($action === 'update') {
                $this->bookings->updateSchedule($hold['pk'], $hold['sk'], $selections);
                $newRefs[] = ['pk' => $hold['pk'], 'sk' => $hold['sk']];
                $reservations[] = $this->reservationEntry($hold['reservable_id'], $campusId, $hold['reservable_name'], $hold['reservable_type'], $selections, $remarksByReservable);
                $appliedBookings[] = [
                    'pk' => $hold['pk'],
                    'sk' => $hold['sk'],
                    'action' => 'updated',
                    'before' => ['reservable_id' => $hold['reservable_id'], 'schedule_selected' => $hold['schedule_selected']],
                    'after' => ['reservable_id' => $hold['reservable_id'], 'schedule_selected' => $selections],
                ];
                continue;
            }

            // swap
            $reservable = $entry['reservable'];
            $created = $this->bookings->createForSubmission($context, $reservable, $selections);
            $this->items->delete($hold['pk'], $hold['sk']);

            $newPk = (string) $created['PK'];
            $newSk = (string) $created['SK'];
            $newReservableId = (string) (DynamoKeys::strip($newPk, 'RESERVABLE#') ?? '');
            $newRefs[] = ['pk' => $newPk, 'sk' => $newSk];
            $reservations[] = $this->reservationEntry($newReservableId, $campusId, (string) ($reservable['name'] ?? ''), (string) ($reservable['type'] ?? ''), $selections, $remarksByReservable);
            $appliedBookings[] = [
                'pk' => $hold['pk'],
                'sk' => $hold['sk'],
                'action' => 'replaced',
                'before' => ['reservable_id' => $hold['reservable_id'], 'schedule_selected' => $hold['schedule_selected']],
                'after' => ['reservable_id' => $newReservableId, 'schedule_selected' => $selections],
                'new_pk' => $newPk,
                'new_sk' => $newSk,
            ];
        }

        $timing = $this->deriveEventTiming($allSelections);
        $activityDetails = is_array($submission['activity_details'] ?? null) ? $submission['activity_details'] : [];
        $activityDetails = array_merge($activityDetails, $timing);

        $venue = is_array($submission['venue_reservation'] ?? null) ? $submission['venue_reservation'] : [];
        $venue['has_reservation'] = true;
        $venue['reservations'] = $reservations;

        $this->items->patch(
            DynamoKeys::event($eventId),
            DynamoKeys::submission($submissionId),
            [
                'activity_details' => $activityDetails,
                'venue_reservation' => $venue,
                'booking_refs' => $newRefs,
            ],
        );

        $submission['activity_details'] = $activityDetails;
        $submission['venue_reservation'] = $venue;
        $submission['booking_refs'] = $newRefs;

        $applied = [
            'bookings' => $appliedBookings,
            'submission' => [
                'status_before' => 'approved',
                'status_after' => 'approved',
                'date_of_event_before' => data_get($change, 'bookings.0.schedule_selected.0.date'),
                'date_of_event_after' => $timing['date_of_event'] ?? null,
                'time_of_event_before' => data_get($submission, 'activity_details.time_of_event'),
                'time_of_event_after' => $timing['time_of_event'] ?? null,
                'booking_refs_before' => $liveRefs,
                'booking_refs_after' => $newRefs,
            ],
        ];

        $this->notifications->create(
            $submissionId,
            $signatoryId,
            'reservation rescheduled',
            $comment !== '' ? $comment : $this->rescheduleSummary($appliedBookings, $timing),
            submission: $submission,
        );

        return $this->changes->finalize($change, [
            'decision' => 'reschedule',
            'resolved_by' => DynamoKeys::signatory($signatoryId),
            'resolved_at' => DynamoKeys::now(),
            'comment' => $comment,
            'applied' => $applied,
            'status' => 'resolved',
        ]);
    }

    /**
     * @param  array<string, mixed>  $change
     * @param  array<string, mixed>  $submission
     * @return array<string, mixed>
     */
    private function deny(array $change, array $submission, string $submissionId, string $signatoryId, string $comment): array
    {
        if ($comment === '') {
            abort(422, 'A comment is required to deny a reservation change.');
        }

        $this->notifications->create(
            $submissionId,
            $signatoryId,
            'reservation change denied',
            $comment,
            submission: $submission,
        );

        return $this->changes->finalize($change, [
            'decision' => 'deny',
            'resolved_by' => DynamoKeys::signatory($signatoryId),
            'resolved_at' => DynamoKeys::now(),
            'comment' => $comment,
            'applied' => ['bookings' => [], 'submission' => null],
            'status' => 'denied',
        ]);
    }

    /**
     * The request's frozen booking linkage, normalized to a stable shape.
     *
     * @param  array<string, mixed>  $change
     * @return list<array{pk: string, sk: string, reservable_id: string, reservable_name: string, reservable_type: string, schedule_selected: list<array{date: string, slots: list<int>}>}>
     */
    private function snapshot(array $change): array
    {
        $holds = [];

        foreach (is_array($change['bookings'] ?? null) ? $change['bookings'] : [] as $hold) {
            if (! is_array($hold)) {
                continue;
            }

            $pk = (string) ($hold['pk'] ?? '');
            $sk = (string) ($hold['sk'] ?? '');

            if ($pk === '' || $sk === '') {
                continue;
            }

            $holds[] = [
                'pk' => $pk,
                'sk' => $sk,
                'reservable_id' => (string) ($hold['reservable_id'] ?? DynamoKeys::strip($pk, 'RESERVABLE#') ?? ''),
                'reservable_name' => (string) ($hold['reservable_name'] ?? ''),
                'reservable_type' => (string) ($hold['reservable_type'] ?? ''),
                'schedule_selected' => $this->bookings->normalize($hold['schedule_selected'] ?? []),
            ];
        }

        return $holds;
    }

    /**
     * @param  array<string, mixed>  $submission
     * @return list<array<string, mixed>>
     */
    private function liveRefs(array $submission): array
    {
        $refs = $submission['booking_refs'] ?? [];

        return is_array($refs) ? array_values($refs) : [];
    }

    /**
     * Index the resolve payload's per-booking instructions by their ref key.
     *
     * @param  mixed  $bookings
     * @return array<string, array<string, mixed>>
     */
    private function instructionsByRef(mixed $bookings): array
    {
        $map = [];

        foreach (is_array($bookings) ? $bookings : [] as $instruction) {
            if (! is_array($instruction)) {
                continue;
            }

            $key = $this->refKey((string) ($instruction['pk'] ?? ''), (string) ($instruction['sk'] ?? ''));
            $map[$key] = $instruction;
        }

        return $map;
    }

    private function refKey(string $pk, string $sk): string
    {
        return $pk."\0".$sk;
    }

    /**
     * Preserve any remarks the paper stored per reservable so a reschedule does
     * not silently drop them.
     *
     * @param  array<string, mixed>  $submission
     * @return array<string, string|null>
     */
    private function remarksByReservable(array $submission): array
    {
        $remarks = [];
        $reservations = data_get($submission, 'venue_reservation.reservations', []);

        foreach (is_array($reservations) ? $reservations : [] as $reservation) {
            if (! is_array($reservation)) {
                continue;
            }

            $id = (string) (DynamoKeys::strip($reservation['reservable_id'] ?? null, 'RESERVABLE#') ?? '');

            if ($id !== '') {
                $remarks[$id] = isset($reservation['remarks']) && is_string($reservation['remarks']) ? $reservation['remarks'] : null;
            }
        }

        return $remarks;
    }

    /**
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @param  array<string, string|null>  $remarksByReservable
     * @return array<string, mixed>
     */
    private function reservationEntry(string $reservableId, string $campusId, string $name, string $type, array $selections, array $remarksByReservable): array
    {
        return [
            'reservable_id' => $reservableId,
            'campus_id' => $campusId,
            'name' => $name,
            'type' => $type,
            'remarks' => $remarksByReservable[$reservableId] ?? null,
            'selections' => $selections,
        ];
    }

    /**
     * Derive the event's date/day/time from the union of all resulting holds:
     * the earliest date, and the earliest-to-latest slot span on that date.
     *
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @return array<string, string>
     */
    private function deriveEventTiming(array $selections): array
    {
        $byDate = [];

        foreach ($selections as $selection) {
            foreach ($selection['slots'] as $slot) {
                $byDate[$selection['date']][] = (int) $slot;
            }
        }

        if ($byDate === []) {
            return [];
        }

        ksort($byDate);
        $date = (string) array_key_first($byDate);
        $slots = $byDate[$date];
        sort($slots);

        $start = ReservableSchedule::slotStart((int) $slots[0]);
        $end = ReservableSchedule::slotEnd((int) $slots[count($slots) - 1]);

        $day = 'Monday';

        try {
            $day = CarbonImmutable::parse($date)->format('l');
        } catch (\Throwable) {
            // Leave the default; an unparseable date is already rejected upstream.
        }

        return [
            'date_of_event' => $date,
            'day_of_event' => $day,
            'time_of_event' => $start.' - '.$end,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $appliedBookings
     * @param  array<string, string>  $timing
     */
    private function rescheduleSummary(array $appliedBookings, array $timing): string
    {
        $when = isset($timing['date_of_event'])
            ? $timing['date_of_event'].' ('.($timing['time_of_event'] ?? '').')'
            : 'the requested time';

        $changed = 0;

        foreach ($appliedBookings as $entry) {
            if (($entry['action'] ?? 'kept') !== 'kept') {
                $changed++;
            }
        }

        return 'Your event reservation was updated for '.$when.'. '.$changed
            .' hold'.($changed === 1 ? '' : 's').' changed.';
    }
}
