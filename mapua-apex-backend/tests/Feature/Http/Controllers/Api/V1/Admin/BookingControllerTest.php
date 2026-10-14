<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Admin;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class BookingControllerTest extends TestCase
{
    // 2026-10-12 is a Monday, so the all-available Mon-Sat template offers every slot.
    private const DATE = '2026-10-12';

    public function test_availability_subtracts_existing_bookings_from_the_template(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => [0]]]);

        $this->withAdminAuth()
            ->getJson('/api/v1/admins/campuses/c001/reservables/r001/availability?start='.self::DATE.'&end='.self::DATE)
            ->assertOk()
            ->assertJsonPath('data.reservable_id', 'r001')
            ->assertJsonPath('data.dates.'.self::DATE.'.booked_slots', [0])
            ->assertJsonPath('data.dates.'.self::DATE.'.available_slots', range(1, 11));
    }

    public function test_lists_bookings_in_range(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => [0]]], 'cdm', ['reason' => 'Setup']);

        $this->withAdminAuth()
            ->getJson('/api/v1/admins/campuses/c001/reservables/r001/bookings?start='.self::DATE.'&end='.self::DATE)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.booking_id', 'b001')
            ->assertJsonPath('data.0.source', 'cdm')
            ->assertJsonPath('data.0.reason', 'Setup');
    }

    public function test_creates_a_manual_booking_without_a_gsi5_or_submission_link(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables/r001/bookings', [
            'selections' => [['date' => self::DATE, 'slots' => [3, 4]]],
            'reason' => 'Dept setup',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.source', 'cdm')
            ->assertJsonPath('data.reason', 'Dept setup');

        $id = $response->json('data.booking_id');
        $this->assertIsString($id);

        $stored = $db->find('RESERVABLE#r001', 'BOOKING#'.$id);
        $this->assertSame('cdm', $stored['source'] ?? null);
        $this->assertArrayNotHasKey('GSI5PK', $stored);
        $this->assertArrayNotHasKey('submission_id', $stored);
        $this->assertSame([['date' => self::DATE, 'slots' => [3, 4]]], $stored['schedule_selected'] ?? null);
    }

    public function test_returns_409_when_the_slot_is_already_booked(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => [0]]]);

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables/r001/bookings', [
            'selections' => [['date' => self::DATE, 'slots' => [0]]],
        ])->assertConflict();
    }

    public function test_returns_422_when_the_slot_index_is_out_of_range(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables/r001/bookings', [
            'selections' => [['date' => self::DATE, 'slots' => [99]]],
        ])->assertUnprocessable()->assertJsonValidationErrors(['selections.0.slots.0']);
    }

    public function test_deletes_a_manual_booking(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => [0]]], 'cdm');

        $this->withAdminAuth()->deleteJson('/api/v1/admins/campuses/c001/reservables/r001/bookings/b001')
            ->assertNoContent();

        $this->assertNull($db->find('RESERVABLE#r001', 'BOOKING#b001'));
    }

    public function test_refuses_to_delete_a_submission_sourced_booking(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => [0]]], 'submission');

        $this->withAdminAuth()->deleteJson('/api/v1/admins/campuses/c001/reservables/r001/bookings/b001')
            ->assertConflict();

        $this->assertNotNull($db->find('RESERVABLE#r001', 'BOOKING#b001'));
    }
}
