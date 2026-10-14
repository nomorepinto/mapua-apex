<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Admin;

use App\Support\Arcus\EventWindow;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\Support\SaafPayload;
use Tests\TestCase;

/**
 * CDM reservation desk: the per-campus queue, the detail view, and resolving a
 * pending request (cancel / reschedule-update / reschedule-swap / deny) with the
 * referential-integrity and audit-trail guarantees the plan requires.
 */
class ReservationChangeTest extends TestCase
{
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
    private function seedApprovedWithBooking(InMemoryDynamoDb $db, string $date, array $slots = [0, 1], string $status = 'approved'): void
    {
        DynamoFixtures::event($db);
        DynamoFixtures::organization($db, 'a1b2');
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
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

        $details = SaafPayload::valid()['activity_details'];
        $details['date_of_event'] = $date;

        DynamoFixtures::submission($db, [
            'status' => $status,
            'activity_details' => $details,
            'venue_reservation' => [
                'has_reservation' => true,
                'reservations' => [SaafPayload::reservation('c001', 'r001', $date, $slots)],
            ],
            'booking_refs' => [['pk' => 'RESERVABLE#r001', 'sk' => 'BOOKING#b001']],
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $bookings
     */
    private function seedChange(
        InMemoryDynamoDb $db,
        array $bookings,
        string $changeId = 'ch001',
        string $requestType = 'reschedule',
        string $status = 'pending',
        string $requestedAt = '2026-10-02T00:00:00Z',
    ): void {
        $db->seed([
            'PK' => 'EVENT#e001',
            'SK' => 'RESERVATION_CHANGE#'.$changeId,
            'GSI6PK' => 'CAMPUS#c001',
            'GSI6SK' => $status.'#'.$requestedAt,
            'item_type' => 'reservation_change',
            'organization_id' => 'a1b2',
            'submission_id' => 's001',
            'campus_id' => 'c001',
            'requested_by' => 'STUDENT#user-1',
            'requested_at' => $requestedAt,
            'request_type' => $requestType,
            'reason' => 'Clashes with finals week.',
            'bookings' => $bookings,
            'status' => $status,
        ]);
    }

    /**
     * @param  list<int>  $slots
     * @return list<array<string, mixed>>
     */
    private function snapshot(string $date, array $slots = [0, 1]): array
    {
        return [[
            'pk' => 'RESERVABLE#r001',
            'sk' => 'BOOKING#b001',
            'reservable_id' => 'r001',
            'reservable_name' => 'Room 1',
            'reservable_type' => 'room',
            'schedule_selected' => [['date' => $date, 'slots' => $slots]],
        ]];
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

    private function noticeOfType(InMemoryDynamoDb $db, string $type): int
    {
        return count(array_filter(
            $this->itemsWithSkPrefix($db, 'NOTIFICATION#'),
            static fn (array $n): bool => ($n['notif_type'] ?? null) === $type,
        ));
    }

    private function resolveUrl(string $changeId = 'ch001'): string
    {
        return '/api/v1/admins/campuses/c001/reservation-changes/'.$changeId.'/resolve';
    }

    public function test_cdm_lists_pending_changes_with_denormalized_context(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);
        $this->seedChange($db, $this->snapshot($date));

        $this->withAdminAuth()
            ->getJson('/api/v1/admins/campuses/c001/reservation-changes?status=pending')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.change_id', 'ch001')
            ->assertJsonPath('data.0.status', 'pending')
            ->assertJsonPath('data.0.event_title', 'Hack Night: Intro to Web Dev')
            ->assertJsonPath('data.0.organization_name', 'Mapua Computing Society');
    }

    public function test_cdm_views_a_single_change_with_its_snapshot(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);
        $this->seedChange($db, $this->snapshot($date));

        $this->withAdminAuth()
            ->getJson('/api/v1/admins/campuses/c001/reservation-changes/ch001')
            ->assertOk()
            ->assertJsonPath('data.change_id', 'ch001')
            ->assertJsonPath('data.bookings.0.pk', 'RESERVABLE#r001')
            ->assertJsonPath('data.submission.submission_id', 's001');
    }

    public function test_resolving_cancel_releases_holds_and_cancels_the_paper(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);
        $this->seedChange($db, $this->snapshot($date), requestType: 'cancel');

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), ['decision' => 'cancel', 'comment' => 'Room needed elsewhere.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved')
            ->assertJsonPath('data.decision', 'cancel');

        // Hold released.
        $this->assertNull($db->find('RESERVABLE#r001', 'BOOKING#b001'));

        // Paper flipped to the terminal status and de-referenced, never deleted.
        $submission = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('cancelled', $submission['status'] ?? null);
        $this->assertArrayNotHasKey('booking_refs', $submission ?? []);

        // Audit trail records the release.
        $change = $db->find('EVENT#e001', 'RESERVATION_CHANGE#ch001');
        $this->assertSame('released', $change['applied']['bookings'][0]['action'] ?? null);
        $this->assertSame('cancelled', $change['applied']['submission']['status_after'] ?? null);
        $this->assertSame(1, $this->noticeOfType($db, 'reservation cancelled'));
    }

    public function test_resolving_reschedule_updates_a_booking_in_place(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $newDate = $this->eventDate(28);
        $this->seedApprovedWithBooking($db, $date);
        $this->seedChange($db, $this->snapshot($date));

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), [
                'decision' => 'reschedule',
                'bookings' => [[
                    'pk' => 'RESERVABLE#r001',
                    'sk' => 'BOOKING#b001',
                    'action' => 'update',
                    'selections' => [['date' => $newDate, 'slots' => [2, 3]]],
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.decision', 'reschedule');

        // Same keys, new schedule, GSI5 linkage intact.
        $booking = $db->find('RESERVABLE#r001', 'BOOKING#b001');
        $this->assertIsArray($booking);
        $this->assertSame([['date' => $newDate, 'slots' => [2, 3]]], $booking['schedule_selected'] ?? null);
        $this->assertSame('ORGANIZATION#a1b2', $booking['GSI5PK'] ?? null);

        // booking_refs entry unchanged (still the same keys).
        $submission = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame([['pk' => 'RESERVABLE#r001', 'sk' => 'BOOKING#b001']], $submission['booking_refs'] ?? null);
        $this->assertSame($newDate, $submission['activity_details']['date_of_event'] ?? null);
        $this->assertSame('approved', $submission['status'] ?? null);

        $change = $db->find('EVENT#e001', 'RESERVATION_CHANGE#ch001');
        $this->assertSame('updated', $change['applied']['bookings'][0]['action'] ?? null);
        $this->assertSame(1, $this->noticeOfType($db, 'reservation rescheduled'));
    }

    public function test_resolving_reschedule_swaps_the_room(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);
        DynamoFixtures::reservable($db, 'c001', 'r002', 'Room 2', 'room');
        $this->seedChange($db, $this->snapshot($date));

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), [
                'decision' => 'reschedule',
                'bookings' => [[
                    'pk' => 'RESERVABLE#r001',
                    'sk' => 'BOOKING#b001',
                    'action' => 'swap',
                    'new_reservable_id' => 'r002',
                    'selections' => [['date' => $date, 'slots' => [4]]],
                ]],
            ])
            ->assertOk();

        // Old hold gone.
        $this->assertNull($db->find('RESERVABLE#r001', 'BOOKING#b001'));

        // New submission-sourced hold under the new reservable, with GSI5.
        $submission = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $refs = $submission['booking_refs'] ?? [];
        $this->assertCount(1, $refs);
        $this->assertSame('RESERVABLE#r002', $refs[0]['pk'] ?? null);

        $newBooking = $db->find($refs[0]['pk'], $refs[0]['sk']);
        $this->assertIsArray($newBooking);
        $this->assertSame('submission', $newBooking['source'] ?? null);
        $this->assertSame('ORGANIZATION#a1b2', $newBooking['GSI5PK'] ?? null);
        $this->assertSame([['date' => $date, 'slots' => [4]]], $newBooking['schedule_selected'] ?? null);

        $change = $db->find('EVENT#e001', 'RESERVATION_CHANGE#ch001');
        $this->assertSame('replaced', $change['applied']['bookings'][0]['action'] ?? null);
        $this->assertSame($refs[0]['pk'], $change['applied']['bookings'][0]['new_pk'] ?? null);
        $this->assertSame($refs[0]['sk'], $change['applied']['bookings'][0]['new_sk'] ?? null);
    }

    public function test_a_stale_request_conflicts_and_writes_nothing(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);
        // Snapshot points at a hold that is no longer linked to the paper.
        $this->seedChange($db, [[
            'pk' => 'RESERVABLE#r001',
            'sk' => 'BOOKING#gone',
            'reservable_id' => 'r001',
            'reservable_name' => 'Room 1',
            'reservable_type' => 'room',
            'schedule_selected' => [['date' => $date, 'slots' => [0]]],
        ]]);

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), [
                'decision' => 'reschedule',
                'bookings' => [[
                    'pk' => 'RESERVABLE#r001',
                    'sk' => 'BOOKING#gone',
                    'action' => 'update',
                    'selections' => [['date' => $this->eventDate(28), 'slots' => [2]]],
                ]],
            ])
            ->assertConflict();

        // Nothing changed: the live hold and the paper survive.
        $this->assertIsArray($db->find('RESERVABLE#r001', 'BOOKING#b001'));
        $submission = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('approved', $submission['status'] ?? null);
        $change = $db->find('EVENT#e001', 'RESERVATION_CHANGE#ch001');
        $this->assertSame('pending', $change['status'] ?? null);
    }

    public function test_a_slot_conflict_conflicts_and_writes_nothing(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $newDate = $this->eventDate(28);
        $this->seedApprovedWithBooking($db, $date);
        // A separate manual hold already occupies the target slot.
        DynamoFixtures::booking($db, 'r001', 'b002', [['date' => $newDate, 'slots' => [2]]], 'cdm');
        $this->seedChange($db, $this->snapshot($date));

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), [
                'decision' => 'reschedule',
                'bookings' => [[
                    'pk' => 'RESERVABLE#r001',
                    'sk' => 'BOOKING#b001',
                    'action' => 'update',
                    'selections' => [['date' => $newDate, 'slots' => [2]]],
                ]],
            ])
            ->assertConflict();

        // Original hold untouched, request still pending.
        $booking = $db->find('RESERVABLE#r001', 'BOOKING#b001');
        $this->assertSame([['date' => $date, 'slots' => [0, 1]]], $booking['schedule_selected'] ?? null);
        $change = $db->find('EVENT#e001', 'RESERVATION_CHANGE#ch001');
        $this->assertSame('pending', $change['status'] ?? null);
    }

    public function test_denying_requires_a_comment(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);
        $this->seedChange($db, $this->snapshot($date), requestType: 'cancel');

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), ['decision' => 'deny'])
            ->assertUnprocessable();
    }

    public function test_denying_leaves_the_paper_and_holds_untouched(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);
        $this->seedChange($db, $this->snapshot($date), requestType: 'cancel');

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), ['decision' => 'deny', 'comment' => 'The slot is final.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'denied')
            ->assertJsonPath('data.decision', 'deny');

        $this->assertIsArray($db->find('RESERVABLE#r001', 'BOOKING#b001'));
        $submission = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('approved', $submission['status'] ?? null);
        $this->assertSame([['pk' => 'RESERVABLE#r001', 'sk' => 'BOOKING#b001']], $submission['booking_refs'] ?? null);
        $this->assertSame(1, $this->noticeOfType($db, 'reservation change denied'));
    }

    public function test_a_resolved_request_cannot_be_resolved_again(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $date = $this->eventDate();
        $this->seedApprovedWithBooking($db, $date);
        $this->seedChange($db, $this->snapshot($date), requestType: 'cancel');

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), ['decision' => 'cancel', 'comment' => 'Cancelled.'])
            ->assertOk();

        $this->withAdminAuth()
            ->postJson($this->resolveUrl(), ['decision' => 'cancel', 'comment' => 'Again.'])
            ->assertConflict();
    }
}
