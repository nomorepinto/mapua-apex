<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Admin;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class SubmissionControllerTest extends TestCase
{
    public function test_returns_401_when_student_jwt_is_used(): void
    {
        $response = $this->withStudentAuth()->getJson('/api/v1/admins/submissions');

        $response->assertUnauthorized();
    }

    public function test_lists_all_submissions(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::submission($db, [
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'GSI1SK' => 'SUBMISSION#s001',
        ]);

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/submissions');

        $response->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001')
            ->assertJsonPath('data.0.organization_name', 'Mapua Computing Society');
    }

    public function test_filters_submissions_by_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::submission($db, [
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'GSI1SK' => 'SUBMISSION#s001',
        ]);
        DynamoFixtures::event($db, 'a1b2', 'e001');
        DynamoFixtures::submission($db, [
            'PK' => 'EVENT#e002',
            'SK' => 'SUBMISSION#s002',
            'GSI1PK' => 'ORGANIZATION#other',
            'GSI1SK' => 'SUBMISSION#s002',
        ]);

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/submissions?organization_id=a1b2');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.submission_id', 's001')
            ->assertJsonPath('data.0.GSI1PK', 'ORGANIZATION#a1b2')
            ->assertJsonPath('data.0.organization_id', 'a1b2');
    }

    public function test_gsi1_query_returns_submissions_and_skips_event_rows(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, 'a1b2', 'e001');
        DynamoFixtures::submission($db, [
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'GSI1SK' => 'SUBMISSION#s001',
        ]);

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/submissions?'.http_build_query([
            'organization_id' => 'ORGANIZATION#a1b2',
        ]));

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.submission_id', 's001')
            ->assertJsonPath('data.0.GSI1PK', 'ORGANIZATION#a1b2');
    }

    public function test_returns_submission_detail_with_notifications(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);
        $db->seed([
            'PK' => 'SUBMISSION#s001',
            'SK' => 'NOTIFICATION#2026-09-11T08:30:00Z',
            'signatory' => 'SIGNATORY#adv001',
            'notif_type' => 'denied',
            'comment' => 'Fix the budget.',
        ]);

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/events/e001/submissions/s001');

        $response->assertOk()
            ->assertJsonPath('data.submission_id', 's001')
            ->assertJsonPath('data.notifications.0.notif_type', 'denied');
        $this->assertArrayNotHasKey('appeals', $response->json('data') ?? []);
    }
}
