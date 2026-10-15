<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Signatory;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class ApproveSubmissionBookingTest extends TestCase
{
    // 2026-10-12 is a Monday, offered by the all-available Mon-Sat template.
    private const DATE = '2026-10-12';

    private function seedPaperOnCdmDesk(InMemoryDynamoDb $db, array $slots = [0, 1]): void
    {
        DynamoFixtures::event($db);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => $slots]], 'submission', [
            'approval_status' => 'pending',
            'campus_id' => 'c001',
            'reservable_name' => 'Room 1',
            'reservable_type' => 'room',
            'event_id' => 'e001',
            'submission_id' => 's001',
            'organization_id' => 'a1b2',
        ]);
        DynamoFixtures::submission($db, [
            'current_signatory' => 'SIGNATORY#cdm001',
            'GSI2PK' => 'SIGNATORY#cdm001',
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#osaar001', 'SIGNATORY#cdm001'],
            'booking_refs' => [['pk' => 'RESERVABLE#r001', 'sk' => 'BOOKING#b001']],
        ]);
    }

    private function withCdmAuth(): static
    {
        return $this->withSignatoryAuth(['custom:signatory_id' => 'cdm001']);
    }

    public function test_cdm_approval_approves_the_pending_holds(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedPaperOnCdmDesk($db);

        $this->withCdmAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $booking = $db->find('RESERVABLE#r001', 'BOOKING#b001');
        $this->assertSame('approved', $booking['approval_status'] ?? null);
        $this->assertSame('SIGNATORY#cdm001', $booking['approved_by'] ?? null);
        $this->assertIsString($booking['approved_at'] ?? null);
    }

    public function test_approved_holds_then_block_availability(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedPaperOnCdmDesk($db);

        $before = $this->withAdminAuth()
            ->getJson('/api/v1/admins/campuses/c001/reservables/r001/availability?start='.self::DATE.'&end='.self::DATE)
            ->assertOk();
        $this->assertSame([], $before->json('data.dates.'.self::DATE.'.booked_slots'));

        $this->withCdmAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/approve')
            ->assertOk();

        $after = $this->withAdminAuth()
            ->getJson('/api/v1/admins/campuses/c001/reservables/r001/availability?start='.self::DATE.'&end='.self::DATE)
            ->assertOk();
        $this->assertSame([0, 1], $after->json('data.dates.'.self::DATE.'.booked_slots'));
    }

    public function test_a_conflict_at_approval_returns_409_and_writes_nothing(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedPaperOnCdmDesk($db);
        DynamoFixtures::booking($db, 'r001', 'taken', [['date' => self::DATE, 'slots' => [1]]], 'submission', [
            'approval_status' => 'approved',
        ]);

        $this->withCdmAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/approve')
            ->assertConflict()
            ->assertJsonPath('message', fn (string $message): bool => str_contains($message, 'Room 1'));

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('pending', $stored['status'] ?? null);
        $this->assertSame('SIGNATORY#cdm001', $stored['current_signatory'] ?? null);

        $booking = $db->find('RESERVABLE#r001', 'BOOKING#b001');
        $this->assertSame('pending', $booking['approval_status'] ?? null);
    }

    public function test_approvals_before_the_cdm_desk_leave_holds_pending(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedPaperOnCdmDesk($db);
        $db->seed(array_merge($db->find('EVENT#e001', 'SUBMISSION#s001') ?? [], [
            'current_signatory' => 'SIGNATORY#adv001',
            'GSI2PK' => 'SIGNATORY#adv001',
        ]));

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/approve')
            ->assertOk()
            ->assertJsonPath('data.current_signatory', 'osaar001');

        $booking = $db->find('RESERVABLE#r001', 'BOOKING#b001');
        $this->assertSame('pending', $booking['approval_status'] ?? null);
    }

    public function test_conflict_preview_is_empty_when_the_slots_are_free(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedPaperOnCdmDesk($db);

        $this->withCdmAuth()
            ->getJson('/api/v1/signatories/events/e001/submissions/s001/booking-conflicts')
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_conflict_preview_lists_slots_taken_by_approved_bookings(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedPaperOnCdmDesk($db);
        DynamoFixtures::booking($db, 'r001', 'manual', [['date' => self::DATE, 'slots' => [0]]], 'cdm');
        // Another paper's pending request on the same slot does not conflict.
        DynamoFixtures::booking($db, 'r001', 'other', [['date' => self::DATE, 'slots' => [1]]], 'submission', [
            'approval_status' => 'pending',
        ]);

        $this->withCdmAuth()
            ->getJson('/api/v1/signatories/events/e001/submissions/s001/booking-conflicts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reservable_id', 'r001')
            ->assertJsonPath('data.0.date', self::DATE)
            ->assertJsonPath('data.0.slot', 0)
            ->assertJsonPath('data.0.reason', 'taken');
    }

    public function test_conflict_preview_is_hidden_from_signatories_outside_the_chain(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedPaperOnCdmDesk($db);

        $this->withSignatoryAuth(['custom:signatory_id' => 'stranger'])
            ->getJson('/api/v1/signatories/events/e001/submissions/s001/booking-conflicts')
            ->assertNotFound();
    }
}
