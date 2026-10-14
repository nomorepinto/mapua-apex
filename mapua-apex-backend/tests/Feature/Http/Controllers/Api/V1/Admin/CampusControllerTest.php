<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Admin;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class CampusControllerTest extends TestCase
{
    public function test_lists_campuses(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001', 'Intramuros');

        $this->withAdminAuth()->getJson('/api/v1/admins/campuses')
            ->assertOk()
            ->assertJsonPath('data.0.campus_id', 'c001')
            ->assertJsonPath('data.0.name', 'Intramuros');
    }

    public function test_creates_a_campus(): void
    {
        $db = InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/campuses', [
            'name' => 'Makati',
        ]);

        $response->assertCreated()->assertJsonPath('data.name', 'Makati');

        $id = $response->json('data.campus_id');
        $this->assertIsString($id);

        $stored = $db->find('CAMPUS#'.$id, 'CAMPUS#'.$id);
        $this->assertSame('Makati', $stored['name'] ?? null);
    }

    public function test_returns_422_when_name_is_missing(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_updates_a_campus(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001', 'Intramuros');

        $this->withAdminAuth()->putJson('/api/v1/admins/campuses/c001', ['name' => 'Main Campus'])
            ->assertOk()
            ->assertJsonPath('data.campus_id', 'c001')
            ->assertJsonPath('data.name', 'Main Campus');

        $this->assertSame('Main Campus', $db->find('CAMPUS#c001', 'CAMPUS#c001')['name'] ?? null);
    }

    public function test_returns_404_when_updating_a_missing_campus(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()->putJson('/api/v1/admins/campuses/missing', ['name' => 'X'])
            ->assertNotFound();
    }

    public function test_creates_a_campus_with_a_classroom_format(): void
    {
        $db = InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/campuses', [
            'name' => 'Makati',
            'classroom_name_prefixes' => ['MPO', 'nw', 'N'],
            'classroom_name_digits' => 3,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.classroom_name_prefixes', ['MPO', 'NW', 'N'])
            ->assertJsonPath('data.classroom_name_digits', 3);

        $id = $response->json('data.campus_id');
        $stored = $db->find('CAMPUS#'.$id, 'CAMPUS#'.$id);
        $this->assertSame(['MPO', 'NW', 'N'], $stored['classroom_name_prefixes'] ?? null);
        $this->assertSame(3, $stored['classroom_name_digits'] ?? null);
    }

    public function test_returns_422_when_classroom_prefixes_have_no_digit_count(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses', [
            'name' => 'Makati',
            'classroom_name_prefixes' => ['MPO'],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['classroom_name_digits']);
    }

    public function test_returns_422_on_an_invalid_classroom_prefix_or_digit_count(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()->postJson('/api/v1/admins/campuses', [
            'name' => 'Makati',
            'classroom_name_prefixes' => ['MPO123'],
            'classroom_name_digits' => 9,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['classroom_name_prefixes.0', 'classroom_name_digits']);
    }

    public function test_deletes_a_campus_without_reservables(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');

        $this->withAdminAuth()->deleteJson('/api/v1/admins/campuses/c001')->assertNoContent();

        $this->assertNull($db->find('CAMPUS#c001', 'CAMPUS#c001'));
    }

    public function test_returns_409_when_the_campus_still_has_reservables(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');

        $this->withAdminAuth()->deleteJson('/api/v1/admins/campuses/c001')->assertConflict();

        $this->assertNotNull($db->find('CAMPUS#c001', 'CAMPUS#c001'));
    }
}
