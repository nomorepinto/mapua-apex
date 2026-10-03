<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class DeadlineControllerTest extends TestCase
{
    public function test_lists_upcoming_deadlines_for_the_jwt_organization(): void
    {
        $this->travelTo('2026-09-10 00:00:00');
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        $db->seed([
            'PK' => 'EVENT#e001',
            'SK' => 'DEADLINE#d001',
            'sent_at' => '2026-09-01T09:00:00Z',
            'deadline' => '2026-09-20T23:59:59Z',
        ]);
        $db->seed([
            'PK' => 'EVENT#e001',
            'SK' => 'DEADLINE#d000',
            'sent_at' => '2026-08-01T09:00:00Z',
            'deadline' => '2026-09-01T23:59:59Z',
        ]);

        $response = $this->withStudentAuth()->getJson('/api/v1/students/deadlines');

        $response->assertOk()
            ->assertJsonPath('data.0.deadline_id', 'd001')
            ->assertJsonCount(1, 'data');
    }
}
