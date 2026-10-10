<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Admin;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class ReservableControllerTest extends TestCase
{
    public function test_lists_reservables_for_a_campus(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001', 'Room 1', 'room');
        DynamoFixtures::reservable($db, 'c001', 'r002', 'Projector', 'equipment');

        $this->withAdminAuth()->getJson('/api/v1/admins/campuses/c001/reservables')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.type', 'room');
    }

    public function test_returns_404_when_the_campus_is_missing(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()->getJson('/api/v1/admins/campuses/missing/reservables')
            ->assertNotFound();
    }

    public function test_creates_a_reservable_and_normalizes_the_schedule(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');

        $schedule = ['monday' => array_fill(0, 12, true)];

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'Room 1',
            'type' => 'room',
            'schedule' => $schedule,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.type', 'room')
            ->assertJsonPath('data.campus_id', 'c001');

        $id = $response->json('data.reservable_id');
        $this->assertIsString($id);

        $stored = $db->find('CAMPUS#c001', 'RESERVABLE#'.$id);
        $this->assertSame('Room 1', $stored['name'] ?? null);
        // Absent days normalize to all-unavailable; monday stays all-available.
        $this->assertSame(array_fill(0, 12, false), $stored['schedule']['tuesday'] ?? null);
        $this->assertSame(array_fill(0, 12, true), $stored['schedule']['monday'] ?? null);
    }

    public function test_returns_422_when_the_type_is_invalid(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'Room 1',
            'type' => 'vehicle',
            'schedule' => [],
        ])->assertUnprocessable()->assertJsonValidationErrors(['type']);
    }

    public function test_updates_a_reservable(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001', 'Room 1', 'room');

        $this->withAdminAuth()->putJson('/api/v1/admins/campuses/c001/reservables/r001', [
            'name' => 'Room 1 Renamed',
            'type' => 'equipment',
            'schedule' => DynamoFixtures::fullSchedule(),
        ])->assertOk()
            ->assertJsonPath('data.name', 'Room 1 Renamed')
            ->assertJsonPath('data.type', 'equipment');

        $this->assertSame('Room 1 Renamed', $db->find('CAMPUS#c001', 'RESERVABLE#r001')['name'] ?? null);
    }

    public function test_deletes_a_reservable_without_bookings(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');

        $this->withAdminAuth()->deleteJson('/api/v1/admins/campuses/c001/reservables/r001')
            ->assertNoContent();

        $this->assertNull($db->find('CAMPUS#c001', 'RESERVABLE#r001'));
    }

    public function test_returns_409_when_the_reservable_still_has_bookings(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => '2026-10-12', 'slots' => [0]]]);

        $this->withAdminAuth()->deleteJson('/api/v1/admins/campuses/c001/reservables/r001')
            ->assertConflict();

        $this->assertNotNull($db->find('CAMPUS#c001', 'RESERVABLE#r001'));
    }
}
