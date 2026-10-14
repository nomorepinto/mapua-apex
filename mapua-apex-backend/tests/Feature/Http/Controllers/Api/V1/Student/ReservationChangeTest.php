<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use App\Support\Arcus\EventWindow;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\Support\SaafPayload;
use Tests\TestCase;

/**
 * Student side of the reservation-change loop: requesting a cancel/reschedule on
 * an approved paper's holds, plus the guards that gate the request.
 */
class ReservationChangeTest extends TestCase
{
    /**
     * A future Monday, so the all-available Mon-Sat template offers it and the
     * request window (which closes at the end of the event day) is still open.
     */
    private function eventDate(int $daysOut = 21): string
    {
        $date = now(EventWindow::TIMEZONE)->addDays($daysOut);

        while ($date->dayOfWeekIso !== 1) {
            $date = $date->addDay();
        }

        return $date->toDateString();
    }

    /**
     * @param  list<int>  $slots
     */
    private function seedApprovedWithBooking(
        InMemoryDynamoDb $db,
        string $date,
        array $slots = [0, 1],
        string $status = 'approved',
        bool $withBooking = true,
    ): void {
        DynamoFixtures::event($db);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');

        if ($withBooking) {
            DynamoFixtures::booking($db, 'r001', 'b001', [['date' => $date, 'slots' => $slots]], 'submission', [
                'campus_id' => 'c001',
                'reservable_name' => 'Room 1',
                'reservable_type' => 'room',
                'event_id' => 'e001',
                'submission_id' => 's001',
                'organization_id' => 'a1b2',
                'GSI5PK' => 'ORGANIZATION#a1b2',
                'GSI5SK' => '2026-10-01T00:00:00Z',
            ]);
        }

        $details = SaafPayload::valid()['activity_details'];
        $details['date_of_event'] = $date;

        DynamoFixtures::submission($db, array_merge([
            'status' => $status,
            'activity_details' => $details,
            'venue_reservation' => [
                'has_reservation' => $withBooking,
                'reservations' => $withBooking
                    ? [SaafPayload::reservation('c001', 'r001', $date, $slots)]
                    : [],
            ],
        ], $withBooking ? [
            'booking_refs' => [['pk' => 'RESERVABLE#r001', 'sk' => 'BOOKING#b001']],
        ] : []));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function itemsWithSkPrefix(InMemoryDynamoDb $db, string $prefix): array
    {
        return array_values(array_filter(
            $db->all(),
            static fn (array $item): bool => str_starts_with((string) ($item['SK'] ?? ''), $prefix),
        ));
    }

    public function test_a_student_can_request_a_reservation_change(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/reservation-change', [
                'request_type' => 'reschedule',
                'reason' => 'Clashes with our finals week.',
                'suggested_date' => $this->eventDate(28),
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.request_type', 'reschedule');

        $changes = $this->itemsWithSkPrefix($db, 'RESERVATION_CHANGE#');
        $this->assertCount(1, $changes);

        $change = $changes[0];
        $this->assertSame('pending#'.$change['requested_at'], $change['GSI6SK'] ?? null);
        $this->assertSame('CAMPUS#c001', $change['GSI6PK'] ?? null);
        $this->assertSame('STUDENT#user-1', $change['requested_by'] ?? null);

        // The snapshot freezes exactly the live holds the request targets.
        $bookings = $change['bookings'] ?? [];
        $this->assertCount(1, $bookings);
        $this->assertSame('RESERVABLE#r001', $bookings[0]['pk'] ?? null);
        $this->assertSame('BOOKING#b001', $bookings[0]['sk'] ?? null);
        $this->assertSame([['date' => $date, 'slots' => [0, 1]]], $bookings[0]['schedule_selected'] ?? null);

        // A timeline row was written for the request.
        $notices = array_values(array_filter(
            $this->itemsWithSkPrefix($db, 'NOTIFICATION#'),
            static fn (array $n): bool => ($n['notif_type'] ?? null) === 'reservation change requested',
        ));
        $this->assertCount(1, $notices);
    }

    public function test_a_change_request_on_a_non_approved_submission_conflicts(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedApprovedWithBooking($db, $this->eventDate(), status: 'pending');

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/reservation-change', [
                'request_type' => 'cancel',
                'reason' => 'No longer needed.',
            ])
            ->assertConflict();

        $this->assertCount(0, $this->itemsWithSkPrefix($db, 'RESERVATION_CHANGE#'));
    }

    public function test_a_change_request_after_the_event_day_conflicts(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $past = now(EventWindow::TIMEZONE)->subDays(3)->toDateString();
        $this->seedApprovedWithBooking($db, $past);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/reservation-change', [
                'request_type' => 'cancel',
                'reason' => 'Too late.',
            ])
            ->assertConflict();

        $this->assertCount(0, $this->itemsWithSkPrefix($db, 'RESERVATION_CHANGE#'));
    }

    public function test_a_dependent_organization_cannot_request_a_change(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedApprovedWithBooking($db, $this->eventDate());

        $this->withStudentAuth(['custom:organization_id' => 'b2c2'])
            ->postJson('/api/v1/students/events/e001/submissions/s001/reservation-change', [
                'request_type' => 'cancel',
                'reason' => 'Not our paper.',
            ])
            ->assertNotFound();
    }

    public function test_a_submission_without_bookings_cannot_request_a_change(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedApprovedWithBooking($db, $this->eventDate(), withBooking: false);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/reservation-change', [
                'request_type' => 'cancel',
                'reason' => 'Nothing booked.',
            ])
            ->assertConflict();
    }

    public function test_a_second_pending_request_conflicts(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedApprovedWithBooking($db, $this->eventDate());

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/reservation-change', [
                'request_type' => 'cancel',
                'reason' => 'First request.',
            ])
            ->assertCreated();

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/reservation-change', [
                'request_type' => 'cancel',
                'reason' => 'Second request.',
            ])
            ->assertConflict();

        $this->assertCount(1, $this->itemsWithSkPrefix($db, 'RESERVATION_CHANGE#'));
    }

    public function test_a_student_can_list_the_papers_change_history(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedApprovedWithBooking($db, $this->eventDate());

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/reservation-change', [
                'request_type' => 'reschedule',
                'reason' => 'Need a new date.',
            ])
            ->assertCreated();

        $this->withStudentAuth()
            ->getJson('/api/v1/students/events/e001/submissions/s001/reservation-changes')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.request_type', 'reschedule')
            ->assertJsonPath('data.0.status', 'pending');
    }
}
