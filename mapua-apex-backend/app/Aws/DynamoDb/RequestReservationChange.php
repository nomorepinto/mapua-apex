<?php

namespace App\Aws\DynamoDb;

use App\Support\Arcus\EventWindow;
use Carbon\CarbonImmutable;

/**
 * Records a student's request to cancel or reschedule the holds on an approved
 * paper. The request is gated to the proponent org, to an approved paper that
 * still holds bookings, and to the window that ends at the close of the event
 * day (Asia/Manila) — the same stateless derivation the arcus windows use.
 */
final class RequestReservationChange
{
    public function __construct(
        private DynamoDbItems $items,
        private GetEvent $events,
        private GetSubmission $submissions,
        private SubmissionAccess $access,
        private ReservationChangeRecords $changes,
        private NotificationRecords $notifications,
    ) {}

    /**
     * @return array<string, mixed>  the created change request
     */
    public function handle(
        string $organizationId,
        string $requestedBy,
        string $eventId,
        string $submissionId,
        string $requestType,
        string $reason,
        ?string $suggestedDate = null,
    ): array {
        $submission = $this->submissions->require($eventId, $submissionId);
        $proponentOrgKey = (string) ($this->events->handle($eventId)['GSI1PK'] ?? '');
        $this->access->authorize($submission, $organizationId, $proponentOrgKey, requireProponent: true);

        if (($submission['status'] ?? null) !== 'approved') {
            abort(409, 'Only an approved submission\'s reservation can be changed.');
        }

        $refs = is_array($submission['booking_refs'] ?? null) ? array_values($submission['booking_refs']) : [];

        if ($refs === []) {
            abort(409, 'This submission has no room or equipment reservation to change.');
        }

        $this->assertWithinRequestWindow($submission);

        if ($this->changes->hasPending($eventId, $submissionId)) {
            abort(409, 'A reservation change is already pending for this event.');
        }

        [$snapshot, $campusId] = $this->snapshotBookings($refs, $submission);

        if ($campusId === '') {
            abort(409, 'This reservation is missing a campus and cannot be changed.');
        }

        $change = $this->changes->create(
            $eventId,
            $submissionId,
            $organizationId,
            $campusId,
            $requestedBy,
            $requestType,
            $reason,
            $snapshot,
            $suggestedDate,
        );

        // Timeline row only; the outcome (not the request) is what emails the
        // student. Student-initiated, so it carries no signatory author.
        $this->notifications->create($submissionId, '', 'reservation change requested', $reason);

        return $change;
    }

    /**
     * A student may request a change only up to the end of the event day.
     *
     * @param  array<string, mixed>  $submission
     */
    private function assertWithinRequestWindow(array $submission): void
    {
        $date = EventWindow::dateOfEvent($submission);

        if ($date === null) {
            abort(409, 'This submission has no scheduled event date to change.');
        }

        $closes = EventWindow::closesAt($date, EventWindow::ATTENDANCE);
        $now = CarbonImmutable::now(EventWindow::TIMEZONE);

        if ($closes !== null && $now->greaterThan($closes)) {
            abort(409, 'Reservation changes close at the end of the event day.');
        }
    }

    /**
     * Freeze the live holds the request targets, and recover the campus they
     * belong to.
     *
     * @param  list<array<string, mixed>>  $refs
     * @param  array<string, mixed>  $submission
     * @return array{0: list<array<string, mixed>>, 1: string}
     */
    private function snapshotBookings(array $refs, array $submission): array
    {
        $snapshot = [];
        $campusId = (string) (data_get($submission, 'venue_reservation.reservations.0.campus_id') ?? '');

        foreach ($refs as $ref) {
            $pk = is_array($ref) ? (string) ($ref['pk'] ?? '') : '';
            $sk = is_array($ref) ? (string) ($ref['sk'] ?? '') : '';

            if ($pk === '' || $sk === '') {
                continue;
            }

            $booking = $this->items->get($pk, $sk);

            if ($booking === null) {
                continue;
            }

            if ($campusId === '' && is_string($booking['campus_id'] ?? null)) {
                $campusId = (string) $booking['campus_id'];
            }

            $snapshot[] = [
                'pk' => $pk,
                'sk' => $sk,
                'reservable_id' => (string) (DynamoKeys::strip($pk, 'RESERVABLE#') ?? ''),
                'reservable_name' => (string) ($booking['reservable_name'] ?? ''),
                'reservable_type' => (string) ($booking['reservable_type'] ?? ''),
                'schedule_selected' => $booking['schedule_selected'] ?? [],
            ];
        }

        return [$snapshot, $campusId];
    }
}
