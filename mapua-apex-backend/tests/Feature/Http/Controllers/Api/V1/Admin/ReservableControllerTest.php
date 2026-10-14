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

    public function test_creates_a_room_with_participant_bounds(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'AV Room',
            'type' => 'room',
            'schedule' => ['monday' => array_fill(0, 12, true)],
            'min_participants' => 50,
            'max_participants' => 100,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.min_participants', 50)
            ->assertJsonPath('data.max_participants', 100)
            ->assertJsonPath('data.capacity_label', 'between 50 and 100 participants');

        $stored = $db->find('CAMPUS#c001', 'RESERVABLE#'.$response->json('data.reservable_id'));
        $this->assertSame(50, $stored['min_participants'] ?? null);
        $this->assertSame(100, $stored['max_participants'] ?? null);
    }

    public function test_participant_bounds_are_dropped_for_equipment(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'Projector',
            'type' => 'equipment',
            'schedule' => ['monday' => array_fill(0, 12, true)],
            'min_participants' => 50,
            'max_participants' => 100,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.min_participants', null)
            ->assertJsonPath('data.max_participants', null);

        $stored = $db->find('CAMPUS#c001', 'RESERVABLE#'.$response->json('data.reservable_id'));
        $this->assertArrayNotHasKey('min_participants', $stored);
        $this->assertArrayNotHasKey('max_participants', $stored);
    }

    public function test_returns_422_when_the_minimum_exceeds_the_maximum(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'AV Room',
            'type' => 'room',
            'schedule' => ['monday' => array_fill(0, 12, true)],
            'min_participants' => 200,
            'max_participants' => 50,
        ])->assertUnprocessable()->assertJsonValidationErrors(['min_participants']);
    }

    public function test_creates_a_classroom_room_matching_the_campus_format(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001', 'Makati', ['prefixes' => ['MPO', 'NW', 'N'], 'digits' => 3]);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'MPO123',
            'type' => 'room',
            'schedule' => ['monday' => array_fill(0, 12, true)],
            'is_classroom' => true,
        ]);

        $response->assertCreated()->assertJsonPath('data.is_classroom', true);

        $stored = $db->find('CAMPUS#c001', 'RESERVABLE#'.$response->json('data.reservable_id'));
        $this->assertTrue($stored['is_classroom'] ?? false);
    }

    public function test_returns_422_when_a_classroom_name_misses_the_format(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001', 'Makati', ['prefixes' => ['MPO', 'NW', 'N'], 'digits' => 3]);

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'AV Room',
            'type' => 'room',
            'schedule' => ['monday' => array_fill(0, 12, true)],
            'is_classroom' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['name']);
    }

    public function test_returns_422_when_a_classroom_is_flagged_but_the_campus_has_no_format(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001', 'Intramuros');

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'Room 1',
            'type' => 'room',
            'schedule' => ['monday' => array_fill(0, 12, true)],
            'is_classroom' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['is_classroom']);
    }

    public function test_non_classroom_room_names_are_not_format_checked(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001', 'Makati', ['prefixes' => ['MPO'], 'digits' => 3]);

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'AV Room',
            'type' => 'room',
            'schedule' => ['monday' => array_fill(0, 12, true)],
            'is_classroom' => false,
        ])->assertCreated()->assertJsonPath('data.is_classroom', false);
    }

    public function test_is_classroom_is_dropped_for_equipment(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001', 'Makati', ['prefixes' => ['MPO'], 'digits' => 3]);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/campuses/c001/reservables', [
            'name' => 'Projector MPO123',
            'type' => 'equipment',
            'schedule' => ['monday' => array_fill(0, 12, true)],
            'is_classroom' => true,
        ]);

        $response->assertCreated()->assertJsonPath('data.is_classroom', false);

        $stored = $db->find('CAMPUS#c001', 'RESERVABLE#'.$response->json('data.reservable_id'));
        $this->assertArrayNotHasKey('is_classroom', $stored);
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
