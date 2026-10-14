<?php

namespace App\Aws\DynamoDb;

use App\Support\Arcus\EventWindow;

/**
 * Step-1 picker source: the organization's events that a post-evaluation may
 * still be filed for. An event qualifies when it has passed, its 3-day
 * evaluation window is still open, and it has no submitted/approved post-eval
 * yet (a denied filing may be re-submitted, so it does not exclude the event).
 *
 * "Passed" is measured from the effective event date: the linked reservation
 * date when the paper reserved a room/equipment, else activity_details.date_of_event.
 */
final class ListEligiblePostEvalEvents
{
    public function __construct(
        private ListOrgSubmissions $submissions,
        private ListOrgPostEvals $postEvals,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function handle(string $organizationId): array
    {
        $blocked = $this->eventsWithOpenPostEvals($organizationId);
        $eligible = [];
        $seen = [];

        foreach ($this->submissions->handle($organizationId) as $submission) {
            if (! in_array($submission['status'] ?? null, ['approved', 'finished'], true)) {
                continue;
            }

            $eventId = DynamoKeys::strip($submission['PK'] ?? null, 'EVENT#');

            if ($eventId === null || $eventId === '' || isset($seen[$eventId]) || isset($blocked[$eventId])) {
                continue;
            }

            $effectiveDate = $this->effectiveDate($submission);

            if ($effectiveDate === null) {
                continue;
            }

            // Recompute the window from the effective date (booking-aware) rather
            // than the raw date_of_event, so a reserved event is gated on when it
            // actually happens.
            if (! EventWindow::isOpenNow(['activity_details' => ['date_of_event' => $effectiveDate]], EventWindow::EVALUATION)) {
                continue;
            }

            $seen[$eventId] = true;

            $eligible[] = [
                'event_id' => $eventId,
                'submission_id' => DynamoKeys::strip($submission['SK'] ?? null, 'SUBMISSION#'),
                'event_title' => data_get($submission, 'activity_details.title_and_nature'),
                'date_of_event' => $effectiveDate,
                'status' => $submission['status'] ?? null,
            ];
        }

        return $eligible;
    }

    /**
     * Event ids that already carry a submitted/approved post-eval (re-filing a
     * denied one is allowed, so denied rows are not collected here).
     *
     * @return array<string, true>
     */
    private function eventsWithOpenPostEvals(string $organizationId): array
    {
        $blocked = [];

        foreach ($this->postEvals->handle($organizationId) as $postEval) {
            if (! in_array($postEval['status'] ?? null, ['submitted', 'approved'], true)) {
                continue;
            }

            $eventId = DynamoKeys::strip($postEval['PK'] ?? null, 'EVENT#');

            if (is_string($eventId) && $eventId !== '') {
                $blocked[$eventId] = true;
            }
        }

        return $blocked;
    }

    /**
     * Reservation date when the paper reserved a room/equipment, else the
     * declared date_of_event.
     *
     * @param  array<string, mixed>  $submission
     */
    private function effectiveDate(array $submission): ?string
    {
        $venue = $submission['venue_reservation'] ?? null;

        if (is_array($venue) && ($venue['has_reservation'] ?? false) === true) {
            $date = $this->earliestReservationDate(is_array($venue['reservations'] ?? null) ? $venue['reservations'] : []);

            if ($date !== null) {
                return $date;
            }
        }

        return EventWindow::dateOfEvent($submission);
    }

    /**
     * @param  list<mixed>  $reservations
     */
    private function earliestReservationDate(array $reservations): ?string
    {
        $dates = [];

        foreach ($reservations as $reservation) {
            if (! is_array($reservation) || ! is_array($reservation['selections'] ?? null)) {
                continue;
            }

            foreach ($reservation['selections'] as $selection) {
                $date = is_array($selection) ? ($selection['date'] ?? null) : null;

                if (is_string($date) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1) {
                    $dates[] = $date;
                }
            }
        }

        if ($dates === []) {
            return null;
        }

        sort($dates);

        return $dates[0];
    }
}
