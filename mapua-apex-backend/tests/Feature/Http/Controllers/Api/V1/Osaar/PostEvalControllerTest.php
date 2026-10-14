<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Osaar;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class PostEvalControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        InMemoryDynamoDb::bind($this);
        $this->freezeTime();
    }

    /**
     * OSAAR uses the admin API key in the SPA, so the review desk is reachable
     * with an `osaar` Cognito group (ROUTE_GROUPS['admin'] includes it).
     *
     * @param  array<string, mixed>  $claims
     */
    private function withOsaarAuth(array $claims = []): static
    {
        return $this->withAdminAuth(array_merge(['cognito:groups' => ['osaar']], $claims));
    }

    /**
     * Seed an approved submission plus a submitted post-eval for the same event.
     */
    private function seedReviewable(InMemoryDynamoDb $db, string $submissionStatus = 'approved', string $postEvalStatus = 'submitted'): void
    {
        DynamoFixtures::organization($db, 'a1b2');
        DynamoFixtures::submission($db, [
            'PK' => 'EVENT#e001',
            'SK' => 'SUBMISSION#s001',
            'status' => $submissionStatus,
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'GSI1SK' => 'SUBMISSION#s001',
        ]);
        DynamoFixtures::postEval($db, ['status' => $postEvalStatus]);
    }

    public function test_returns_401_when_student_jwt_is_used(): void
    {
        $this->withStudentAuth()->getJson('/api/v1/admins/postevals')->assertUnauthorized();
    }

    public function test_index_lists_postevals_across_organizations(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        DynamoFixtures::organization($db, 'b2c2', 'Second Org');
        DynamoFixtures::postEval($db);
        DynamoFixtures::postEval($db, [
            'PK' => 'EVENT#e002',
            'SK' => 'POSTEVAL#pe002',
            'GSI1PK' => 'ORGANIZATION#b2c2',
            'GSI1SK' => 'POSTEVAL#pe002',
            'organization_id' => 'b2c2',
            'event_id' => 'e002',
        ]);

        $this->withOsaarAuth()->getJson('/api/v1/admins/postevals')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.organization_name', 'Mapua Computing Society');
    }

    public function test_index_filters_by_status(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        DynamoFixtures::postEval($db, ['status' => 'submitted']);
        DynamoFixtures::postEval($db, [
            'PK' => 'EVENT#e002',
            'SK' => 'POSTEVAL#pe002',
            'GSI1SK' => 'POSTEVAL#pe002',
            'event_id' => 'e002',
            'status' => 'approved',
        ]);

        $this->withOsaarAuth()->getJson('/api/v1/admins/postevals?status=approved')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.posteval_id', 'pe002')
            ->assertJsonPath('data.0.status', 'approved');
    }

    public function test_show_returns_the_posteval_detail(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        DynamoFixtures::postEval($db);

        $this->withOsaarAuth()->getJson('/api/v1/admins/postevals/e001/pe001')
            ->assertOk()
            ->assertJsonPath('data.posteval_id', 'pe001')
            ->assertJsonPath('data.event_id', 'e001')
            ->assertJsonPath('data.status', 'submitted');
    }

    public function test_show_returns_404_for_a_missing_posteval(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withOsaarAuth()->getJson('/api/v1/admins/postevals/e001/nope')->assertNotFound();
    }

    public function test_approve_marks_the_posteval_approved_and_finishes_the_submission(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedReviewable($db);

        $this->withOsaarAuth()->postJson('/api/v1/admins/postevals/e001/pe001/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $postEval = $db->find('EVENT#e001', 'POSTEVAL#pe001');
        $this->assertSame('approved', $postEval['status'] ?? null);
        $this->assertArrayHasKey('approved_at', $postEval ?? []);

        $submission = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('finished', $submission['status'] ?? null);
        $this->assertArrayHasKey('finished_at', $submission ?? []);
    }

    public function test_approve_is_idempotent(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedReviewable($db, 'finished', 'approved');

        $this->withOsaarAuth()->postJson('/api/v1/admins/postevals/e001/pe001/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $submission = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('finished', $submission['status'] ?? null);
    }

    public function test_approve_rejects_a_denied_posteval(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedReviewable($db, 'approved', 'denied');

        $this->withOsaarAuth()->postJson('/api/v1/admins/postevals/e001/pe001/approve')->assertStatus(422);
    }

    public function test_deny_marks_the_posteval_denied_and_leaves_the_submission_approved(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedReviewable($db);

        $this->withOsaarAuth()->postJson('/api/v1/admins/postevals/e001/pe001/deny')
            ->assertOk()
            ->assertJsonPath('data.status', 'denied');

        $postEval = $db->find('EVENT#e001', 'POSTEVAL#pe001');
        $this->assertSame('denied', $postEval['status'] ?? null);
        $this->assertArrayHasKey('denied_at', $postEval ?? []);

        $submission = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('approved', $submission['status'] ?? null);
        $this->assertArrayNotHasKey('finished_at', $submission ?? []);
    }

    public function test_deny_rejects_an_approved_posteval(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedReviewable($db, 'finished', 'approved');

        $this->withOsaarAuth()->postJson('/api/v1/admins/postevals/e001/pe001/deny')->assertStatus(422);
    }
}
