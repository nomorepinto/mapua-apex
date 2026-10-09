<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Arcus;

use App\Support\Arcus\EventWindow;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class EventControllerTest extends TestCase
{
    private const TOKEN = 'arcus-test-secret';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.arcus.service_token' => self::TOKEN,
            'services.arcus.post_evaluation_window_days' => 3,
        ]);

        $this->freezeTime();
    }

    private function day(int $offset = 0): string
    {
        return now(EventWindow::TIMEZONE)->addDays($offset)->toDateString();
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function withServiceAuth(array $headers = []): static
    {
        return $this->withHeaders(array_merge(['X-Arcus-Service-Token' => self::TOKEN], $headers));
    }

    private function seedSubmission(InMemoryDynamoDb $db, string $event, string $submission, string $org, string $status, string $dateOfEvent): void
    {
        DynamoFixtures::submission($db, [
            'PK' => 'EVENT#'.$event,
            'SK' => 'SUBMISSION#'.$submission,
            'status' => $status,
            'GSI1PK' => 'ORGANIZATION#'.$org,
            'GSI1SK' => 'SUBMISSION#'.$submission,
            'activity_details' => ['date_of_event' => $dateOfEvent],
        ]);
    }

    public function test_requests_without_a_service_token_are_rejected(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->getJson('/api/v1/arcus/events')->assertUnauthorized();
    }

    public function test_requests_with_a_wrong_service_token_are_rejected(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withHeaders(['X-Arcus-Service-Token' => 'nope'])
            ->getJson('/api/v1/arcus/events')
            ->assertUnauthorized();
    }

    public function test_arcus_routes_fail_closed_when_the_token_is_unconfigured(): void
    {
        config(['services.arcus.service_token' => '']);
        InMemoryDynamoDb::bind($this);

        $this->withHeaders(['X-Arcus-Service-Token' => ''])
            ->getJson('/api/v1/arcus/events')
            ->assertStatus(503);
    }

    public function test_index_lists_only_published_events_whose_window_is_open(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day());
        $this->seedSubmission($db, 'e002', 's002', 'a1b2', 'pending', $this->day());
        $this->seedSubmission($db, 'e003', 's003', 'a1b2', 'approved', $this->day(5));

        $this->withServiceAuth()->getJson('/api/v1/arcus/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.submission_id', 's001')
            ->assertJsonPath('data.0.attendance.is_open', true);
    }

    public function test_index_scopes_to_the_organization_header(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        DynamoFixtures::organization($db, 'b2c2', 'Second Org');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day());
        $this->seedSubmission($db, 'e002', 's002', 'b2c2', 'approved', $this->day());

        $this->withServiceAuth(['X-Arcus-Organization-Id' => 'a1b2'])
            ->getJson('/api/v1/arcus/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_evaluation_index_excludes_events_past_the_post_evaluation_window(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day(-1));
        $this->seedSubmission($db, 'e002', 's002', 'a1b2', 'approved', $this->day(-10));

        $this->withServiceAuth()->getJson('/api/v1/arcus/events?window=evaluation')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_finish_marks_an_approved_submission_finished_within_the_window(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day());

        $this->withServiceAuth()
            ->postJson('/api/v1/arcus/events/e001/submissions/s001/finish')
            ->assertOk()
            ->assertJsonPath('data.status', 'finished');

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('finished', $stored['status'] ?? null);
        $this->assertArrayHasKey('finished_at', $stored ?? []);
    }

    public function test_finish_is_idempotent(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'finished', $this->day());

        $this->withServiceAuth()
            ->postJson('/api/v1/arcus/events/e001/submissions/s001/finish')
            ->assertOk()
            ->assertJsonPath('data.status', 'finished');
    }

    public function test_finish_rejects_a_submission_that_is_not_approved(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'pending', $this->day());

        $this->withServiceAuth()
            ->postJson('/api/v1/arcus/events/e001/submissions/s001/finish')
            ->assertStatus(422);
    }

    public function test_finish_rejects_a_call_outside_the_evaluation_window(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day(5));

        $this->withServiceAuth()
            ->postJson('/api/v1/arcus/events/e001/submissions/s001/finish')
            ->assertStatus(422);
    }

    public function test_finish_is_scoped_to_the_organization_header(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day());

        $this->withServiceAuth(['X-Arcus-Organization-Id' => 'b2c2'])
            ->postJson('/api/v1/arcus/events/e001/submissions/s001/finish')
            ->assertNotFound();
    }
}
