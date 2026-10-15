<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Arcus;

use App\Support\Arcus\EventWindow;
use PHPUnit\Framework\Attributes\TestWith;
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

    public function test_index_excludes_cancelled_events(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day());
        $this->seedSubmission($db, 'e002', 's002', 'a1b2', 'cancelled', $this->day());

        $this->withServiceAuth()->getJson('/api/v1/arcus/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.submission_id', 's001');
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

    public function test_student_events_returns_only_attended_in_window_events(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day(-1));
        $this->seedSubmission($db, 'e002', 's002', 'a1b2', 'approved', $this->day(-1));
        $this->seedSubmission($db, 'e003', 's003', 'a1b2', 'approved', $this->day(-10));
        DynamoFixtures::student($db, '202100001');
        DynamoFixtures::checkIn($db, 'e001', '202100001');
        DynamoFixtures::checkIn($db, 'e003', '202100001');
        DynamoFixtures::checkIn($db, 'e002', '202100002');

        $this->withServiceAuth()
            ->getJson('/api/v1/arcus/students/202100001/events?window=evaluation')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.event_id', 'e001')
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_student_events_is_empty_for_a_student_who_attended_nothing(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day(-1));

        $this->withServiceAuth()
            ->getJson('/api/v1/arcus/students/202100099/events?window=evaluation')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_event_post_eval_returns_participants_and_post_eval_status(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day(-1));
        DynamoFixtures::student($db, '202100001');
        DynamoFixtures::checkIn($db, 'e001', '202100001');
        DynamoFixtures::evaluation($db, 'e001', 'ev001', '202100001');
        DynamoFixtures::postEval($db, ['status' => 'submitted']);

        $this->withServiceAuth()->getJson('/api/v1/arcus/events/e001/post-eval')
            ->assertOk()
            ->assertJsonPath('event_id', 'e001')
            ->assertJsonPath('submission_id', 's001')
            ->assertJsonPath('attendance_count', 1)
            ->assertJsonPath('evaluation_count', 1)
            ->assertJsonPath('evaluations.0.participated', true)
            ->assertJsonPath('post_eval.status', 'submitted')
            ->assertJsonPath('post_eval.posteval_id', 'pe001');
    }

    public function test_event_post_eval_reports_none_when_no_post_eval_exists(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day(-1));

        $this->withServiceAuth()->getJson('/api/v1/arcus/events/e001/post-eval')
            ->assertOk()
            ->assertJsonPath('post_eval.status', 'none')
            ->assertJsonPath('attendance_count', 0)
            ->assertJsonPath('evaluation_count', 0);
    }

    public function test_event_post_eval_is_scoped_to_the_organization_header(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2');
        DynamoFixtures::organization($db, 'b2c2', 'Second Org');
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day(-1));

        $this->withServiceAuth(['X-Arcus-Organization-Id' => 'b2c2'])
            ->getJson('/api/v1/arcus/events/e001/post-eval')
            ->assertForbidden();
    }

    #[TestWith(['/api/v1/arcus/students/202100001/events?window=evaluation'])]
    #[TestWith(['/api/v1/arcus/events/e001/post-eval'])]
    public function test_new_endpoints_require_service_authentication(string $path): void
    {
        InMemoryDynamoDb::bind($this);

        $this->getJson($path)->assertUnauthorized();
    }

    #[TestWith(['submitted'])]
    #[TestWith(['approved'])]
    #[TestWith(['denied'])]
    public function test_post_eval_uses_latest_filing_and_its_linked_submission(string $status): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedSubmission($db, 'e001', 'old', 'a1b2', 'denied', $this->day(-1));
        $this->seedSubmission($db, 'e001', 'current', 'a1b2', 'approved', $this->day(-1));
        DynamoFixtures::postEval($db, [
            'SK' => 'POSTEVAL#a-old',
            'submission_id' => 'old',
            'status' => 'denied',
            'submitted_at' => '2026-09-11T08:00:00Z',
        ]);
        DynamoFixtures::postEval($db, [
            'SK' => 'POSTEVAL#z-current',
            'submission_id' => 'current',
            'status' => $status,
            'submitted_at' => '2026-09-12T08:00:00Z',
        ]);
        DynamoFixtures::postEval($db, [
            'SK' => 'POSTEVAL#orphan',
            'submission_id' => 'missing',
            'submitted_at' => '2026-09-13T08:00:00Z',
        ]);

        $this->withServiceAuth()->getJson('/api/v1/arcus/events/e001/post-eval')
            ->assertOk()
            ->assertJsonPath('submission_id', 'current')
            ->assertJsonPath('post_eval.posteval_id', 'z-current')
            ->assertJsonPath('post_eval.status', $status);
    }

    public function test_post_eval_prefers_an_active_filing_over_denied_history(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedSubmission($db, 'e001', 's001', 'a1b2', 'approved', $this->day(-1));
        DynamoFixtures::postEval($db, ['SK' => 'POSTEVAL#active']);
        DynamoFixtures::postEval($db, [
            'SK' => 'POSTEVAL#denied',
            'status' => 'denied',
            'submitted_at' => '2026-09-12T08:00:00Z',
        ]);

        $this->withServiceAuth()->getJson('/api/v1/arcus/events/e001/post-eval')
            ->assertOk()
            ->assertJsonPath('post_eval.posteval_id', 'active');
    }

    public function test_event_post_eval_is_not_found_for_an_unknown_event(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withServiceAuth()->getJson('/api/v1/arcus/events/nope/post-eval')
            ->assertNotFound();
    }
}
