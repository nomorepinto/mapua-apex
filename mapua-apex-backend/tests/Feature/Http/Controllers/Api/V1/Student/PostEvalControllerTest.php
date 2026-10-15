<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use App\Support\Arcus\EventWindow;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class PostEvalControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['services.arcus.post_evaluation_window_days' => 3]);
        InMemoryDynamoDb::bind($this);
        $this->freezeTime();
    }

    private function day(int $offset = 0): string
    {
        return now(EventWindow::TIMEZONE)->addDays($offset)->toDateString();
    }

    /**
     * Seed the event parent plus a submission in a given state/date.
     *
     * @param  array<string, mixed>  $extra
     */
    private function seedSubmission(
        InMemoryDynamoDb $db,
        string $event,
        string $submission,
        string $status,
        string $dateOfEvent,
        string $org = 'a1b2',
        array $extra = [],
    ): void {
        DynamoFixtures::event($db, $org, $event);

        $db->seed(array_merge([
            'PK' => 'EVENT#'.$event,
            'SK' => 'SUBMISSION#'.$submission,
            'submission_type' => 'saaf',
            'sent_at' => '2026-09-10T14:00:00Z',
            'status' => $status,
            'GSI1PK' => 'ORGANIZATION#'.$org,
            'GSI1SK' => 'SUBMISSION#'.$submission,
            'activity_details' => ['date_of_event' => $dateOfEvent, 'title_and_nature' => 'Hack Night'],
            'venue_reservation' => ['has_reservation' => false, 'reservations' => []],
        ], $extra));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_replace_recursive([
            'event_id' => 'e001',
            'submission_id' => 's001',
            'section_summary' => 'The event ran smoothly, attendees were engaged, and the schedule was followed closely from start to finish.',
            'financial_report' => [
                'budget_items' => [
                    ['item' => 'Snacks', 'unit' => 'packs', 'quantity' => 60, 'budgeted_total' => 3000, 'actual_amount' => 2800],
                ],
                'added_items' => [
                    ['item' => 'Extra chairs', 'unit' => 'pcs', 'quantity' => 10, 'price_per_unit' => 50, 'actual_amount' => 500],
                ],
                'initial_grand_total' => 3000,
                'actual_grand_total' => 3300,
            ],
        ], $overrides);
    }

    public function test_events_lists_only_passed_in_window_events(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'approved', $this->day());      // today -> eligible
        $this->seedSubmission($db, 'e002', 's002', 'approved', $this->day(5));     // future -> not passed
        $this->seedSubmission($db, 'e003', 's003', 'approved', $this->day(-10));   // past window -> closed

        $this->withStudentAuth()->getJson('/api/v1/students/postevals/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.event_id', 'e001')
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_events_excludes_pending_and_denied_submissions(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'pending', $this->day());
        $this->seedSubmission($db, 'e002', 's002', 'approved', $this->day());

        $this->withStudentAuth()->getJson('/api/v1/students/postevals/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.event_id', 'e002');
    }

    public function test_events_excludes_an_event_that_already_has_an_active_posteval(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'approved', $this->day());
        DynamoFixtures::postEval($db, ['status' => 'submitted']);

        $this->withStudentAuth()->getJson('/api/v1/students/postevals/events')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_events_allows_refiling_after_a_denied_posteval(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'approved', $this->day());
        DynamoFixtures::postEval($db, ['status' => 'denied']);

        $this->withStudentAuth()->getJson('/api/v1/students/postevals/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.event_id', 'e001');
    }

    public function test_store_creates_a_posteval_and_freezes_the_participation_snapshot(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'approved', $this->day());
        DynamoFixtures::student($db, '2021-00123');
        DynamoFixtures::checkIn($db, 'e001', '2021-00123');
        DynamoFixtures::evaluation($db, 'e001', 'ev001', '2021-00123');

        $response = $this->withStudentAuth()->postJson('/api/v1/students/postevals', $this->payload());

        $response->assertCreated()
            ->assertJsonPath('data.event_id', 'e001')
            ->assertJsonPath('data.submission_id', 's001')
            ->assertJsonPath('data.status', 'submitted')
            ->assertJsonPath('data.participation_snapshot.attendance_count', 1)
            ->assertJsonPath('data.participation_snapshot.evaluation_count', 1)
            ->assertJsonPath('data.participation_snapshot.attendance.0.full_name', 'Juan Dela Cruz');

        $postEvalId = $response->json('data.posteval_id');
        $this->assertIsString($postEvalId);
        $stored = $db->find('EVENT#e001', 'POSTEVAL#'.$postEvalId);
        $this->assertSame('submitted', $stored['status'] ?? null);
        $this->assertSame('ORGANIZATION#a1b2', $stored['GSI1PK'] ?? null);
        $this->assertSame('POSTEVAL#'.$postEvalId, $stored['GSI1SK'] ?? null);
    }

    public function test_store_rejects_a_summary_shorter_than_100_characters(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'approved', $this->day());

        $this->withStudentAuth()
            ->postJson('/api/v1/students/postevals', $this->payload(['section_summary' => 'Too short']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['section_summary']);
    }

    public function test_store_rejects_an_amount_over_five_digits(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'approved', $this->day());

        $payload = $this->payload();
        $payload['financial_report']['budget_items'][0]['actual_amount'] = 100000;

        $this->withStudentAuth()
            ->postJson('/api/v1/students/postevals', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['financial_report.budget_items.0.actual_amount']);
    }

    public function test_store_rejects_a_filing_outside_the_evaluation_window(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'approved', $this->day(-10));

        $this->withStudentAuth()
            ->postJson('/api/v1/students/postevals', $this->payload())
            ->assertStatus(422);
    }

    public function test_store_rejects_a_second_active_posteval_for_the_same_event(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        $this->seedSubmission($db, 'e001', 's001', 'approved', $this->day());
        DynamoFixtures::postEval($db, ['status' => 'submitted']);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/postevals', $this->payload())
            ->assertStatus(409);
    }

    public function test_index_lists_only_the_jwt_organization_postevals(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::postEval($db);
        DynamoFixtures::postEval($db, [
            'PK' => 'EVENT#e002',
            'SK' => 'POSTEVAL#pe002',
            'GSI1PK' => 'ORGANIZATION#other',
            'GSI1SK' => 'POSTEVAL#pe002',
            'organization_id' => 'other',
            'event_id' => 'e002',
        ]);

        $this->withStudentAuth()->getJson('/api/v1/students/postevals')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.posteval_id', 'pe001');
    }

    public function test_show_returns_404_for_another_organizations_posteval(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::postEval($db, ['GSI1PK' => 'ORGANIZATION#other', 'organization_id' => 'other']);

        $this->withStudentAuth()->getJson('/api/v1/students/events/e001/postevals/pe001')
            ->assertNotFound();
    }

    public function test_show_returns_the_posteval_with_a_live_participation_aggregation(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::postEval($db);
        DynamoFixtures::student($db, '2021-00123');
        DynamoFixtures::checkIn($db, 'e001', '2021-00123');

        $this->withStudentAuth()->getJson('/api/v1/students/events/e001/postevals/pe001')
            ->assertOk()
            ->assertJsonPath('data.posteval_id', 'pe001')
            ->assertJsonPath('data.participation.attendance_count', 1);
    }

    public function test_participants_returns_live_aggregation_for_an_owned_event(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::event($db);
        DynamoFixtures::student($db, '2021-00123');
        DynamoFixtures::checkIn($db, 'e001', '2021-00123');
        DynamoFixtures::evaluation($db, 'e001', 'ev001', '2021-00123');
        DynamoFixtures::evaluation($db, 'e001', 'ev002', '2021-00124', 'Maria Santos', false);

        $response = $this->withStudentAuth()->getJson('/api/v1/students/events/e001/participants');

        $response->assertOk()
            ->assertJsonPath('data.attendance_count', 1)
            ->assertJsonPath('data.evaluation_count', 2)
            ->assertJsonPath('data.attendance.0.student_id', '2021-00123');

        // arcus-evaluation stores "yes"/"no"; a "no" must not truthy-cast to true.
        $evaluations = collect($response->json('data.evaluations'));
        $this->assertTrue($evaluations->firstWhere('evaluation_id', 'ev001')['participated']);
        $this->assertFalse($evaluations->firstWhere('evaluation_id', 'ev002')['participated']);
    }

    public function test_participants_returns_404_for_another_organizations_event(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, org: 'other-org');

        $this->withStudentAuth()->getJson('/api/v1/students/events/e001/participants')
            ->assertNotFound();
    }
}
