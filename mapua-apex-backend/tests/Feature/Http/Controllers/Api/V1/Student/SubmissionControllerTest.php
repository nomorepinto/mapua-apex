<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\Support\SaafPayload;
use Tests\TestCase;

class SubmissionControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        InMemoryDynamoDb::bind($this);
    }

    public function test_returns_401_when_signatory_jwt_is_used(): void
    {
        $response = $this->withSignatoryAuth()->getJson('/api/v1/students/submissions');

        $response->assertUnauthorized();
    }

    public function test_defaults_to_admin_org_when_admin_omits_organization(): void
    {
        $response = $this->withAdminAuth()->getJson('/api/v1/students/submissions');

        $response->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_lists_submissions_when_admin_sends_an_organization_header(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);

        $response = $this->withAdminAuth()
            ->withHeaders(['X-Organization-Id' => 'a1b2'])
            ->getJson('/api/v1/students/submissions');

        $response->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_returns_401_when_osaar_calls_a_student_route(): void
    {
        InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth(['cognito:groups' => ['osaar']])
            ->withHeaders(['X-Organization-Id' => 'a1b2'])
            ->getJson('/api/v1/students/submissions');

        $response->assertUnauthorized()
            ->assertJsonPath('message', "Unauthenticated: User is not in the required 'student' or 'admin' Cognito group.");
    }

    public function test_ignores_organization_header_for_a_student_jwt(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, org: 'other-org');
        DynamoFixtures::submission($db);

        $response = $this->withStudentAuth()
            ->withHeaders(['X-Organization-Id' => 'other-org'])
            ->getJson('/api/v1/students/events/e001/submissions/s001');

        $response->assertNotFound();
    }

    public function test_returns_401_when_student_omits_organization_claim_even_with_header(): void
    {
        InMemoryDynamoDb::bind($this);

        $response = $this->withStudentAuth([
            'custom:organization_id' => '',
        ])->withHeaders(['X-Organization-Id' => 'a1b2'])
            ->getJson('/api/v1/students/submissions');

        $response->assertUnauthorized();
    }

    public function test_returns_401_when_jwt_is_missing(): void
    {
        $this->fakeCognitoJwt();

        $response = $this->getJson('/api/v1/students/submissions');

        $response->assertUnauthorized();
    }

    public function test_returns_401_when_jwt_is_invalid(): void
    {
        $response = $this->withStudentAuth(jwt: 'invalid-jwt')->getJson('/api/v1/students/submissions');

        $response->assertUnauthorized();
    }

    public function test_returns_submissions_for_the_jwt_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);

        $response = $this->withStudentAuth()->getJson('/api/v1/students/submissions');

        $response->assertOk()
            ->assertJsonPath('data.0.event_id', 'e001')
            ->assertJsonPath('data.0.submission_id', 's001')
            ->assertJsonPath('data.0.submission_type', 'saaf')
            ->assertJsonPath('data.0.current_signatory', 'adv001')
            ->assertJsonPath('data.0.activity_details.title_and_nature', 'Hack Night: Intro to Web Dev');
    }

    public function test_lists_only_submissions_for_the_jwt_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);
        DynamoFixtures::event($db, org: 'other-org', event: 'e002');
        DynamoFixtures::submission($db, [
            'PK' => 'EVENT#e002',
            'SK' => 'SUBMISSION#s002',
        ]);

        $response = $this->withStudentAuth()->getJson('/api/v1/students/submissions');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.event_id', 'e001')
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_returns_an_empty_collection_when_the_organization_has_no_submissions(): void
    {
        InMemoryDynamoDb::bind($this);

        $response = $this->withStudentAuth()->getJson('/api/v1/students/submissions');

        $response->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_returns_404_when_submission_belongs_to_another_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, org: 'other-org');
        DynamoFixtures::submission($db);

        $response = $this->withStudentAuth()->getJson('/api/v1/students/events/e001/submissions/s001');

        $response->assertNotFound();
    }

    public function test_returns_one_submission_for_the_jwt_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);

        $response = $this->withStudentAuth()->getJson('/api/v1/students/events/e001/submissions/s001');

        $response->assertOk()
            ->assertJsonPath('data.submission_id', 's001')
            ->assertJsonPath('data.event_id', 'e001');
    }

    public function test_returns_422_when_create_payload_is_empty(): void
    {
        InMemoryDynamoDb::bind($this);

        $response = $this->withStudentAuth()->postJson('/api/v1/students/submissions', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['event_id', 'submission_type', 'activity_classification', 'proponents']);
    }

    public function test_returns_422_when_event_date_is_sooner_than_10_days(): void
    {
        $this->travelTo('2026-09-22 08:00:00');
        InMemoryDynamoDb::bind($this);

        $response = $this->withStudentAuth()->postJson(
            '/api/v1/students/submissions',
            SaafPayload::valid([
                'activity_details' => [
                    'date_of_event' => '2026-09-30',
                ],
            ]),
        );

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['activity_details.date_of_event']);

        $errors = $response->json('errors');
        $this->assertIsArray($errors);
        $this->assertSame(
            ['The date of event must be at least 10 days from today.'],
            $errors['activity_details.date_of_event'] ?? null,
        );
    }

    public function test_creates_a_submission_when_event_date_is_exactly_10_days_away(): void
    {
        $this->travelTo('2026-09-22 08:00:00');
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'osaar001', 'osaar');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');

        $response = $this->withStudentAuth()->postJson(
            '/api/v1/students/submissions',
            SaafPayload::valid([
                'activity_details' => [
                    'date_of_event' => '2026-10-02',
                    'end_date_of_event' => '2026-10-02',
                ],
            ]),
        );

        $response->assertCreated()
            ->assertJsonPath('data.activity_details.date_of_event', '2026-10-02');
    }

    public function test_creates_a_submission_and_routes_to_the_adviser(): void
    {
        $this->freezeTime();
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'osaar001', 'osaar');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');

        $response = $this->withStudentAuth()->postJson('/api/v1/students/submissions', SaafPayload::valid());

        $response->assertCreated()
            ->assertJsonPath('data.event_id', 'e001')
            ->assertJsonPath('data.current_signatory', 'adv001')
            ->assertJsonPath('data.status', 'pending');

        $submissionId = $response->json('data.submission_id');
        $this->assertIsString($submissionId);
        $stored = $db->find('EVENT#e001', 'SUBMISSION#'.$submissionId);
        $this->assertSame('SIGNATORY#adv001', $stored['GSI2PK'] ?? null);
    }

    public function test_creates_a_submission_and_stores_the_signatory_sequence(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'osaar001', 'osaar');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');

        $response = $this->withStudentAuth()->postJson('/api/v1/students/submissions', SaafPayload::valid());

        $response->assertCreated()
            ->assertJsonPath('data.current_signatory', 'adv001')
            ->assertJsonPath('data.signatory_sequence', ['adv001', 'osaar001', 'cdm001']);

        $submissionId = $response->json('data.submission_id');
        $this->assertIsString($submissionId);
        $stored = $db->find('EVENT#e001', 'SUBMISSION#'.$submissionId);
        $this->assertSame(
            ['SIGNATORY#adv001', 'SIGNATORY#osaar001', 'SIGNATORY#cdm001'],
            $stored['signatory_sequence'] ?? null,
        );
        $this->assertSame($stored['signatory_sequence'][0] ?? null, $stored['current_signatory'] ?? null);
    }

    public function test_creates_a_submission_when_osaar_and_cdm_are_only_in_env(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');

        $response = $this->withStudentAuth()->postJson('/api/v1/students/submissions', SaafPayload::valid());

        $response->assertCreated()
            ->assertJsonPath('data.current_signatory', 'adv001');
    }

    public function test_updates_a_returned_submission_and_keeps_it_on_the_same_desk(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'osaar001', 'osaar');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');
        DynamoFixtures::submission($db, [
            'status' => 'returned',
            'current_signatory' => 'SIGNATORY#osaar001',
            'GSI2PK' => 'SIGNATORY#osaar001',
        ]);

        $payload = SaafPayload::valid();
        unset($payload['event_id']);

        $response = $this->withStudentAuth()->putJson(
            '/api/v1/students/events/e001/submissions/s001',
            $payload,
        );

        $response->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.current_signatory', 'osaar001');

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('SIGNATORY#osaar001', $stored['GSI2PK'] ?? null);
    }

    public function test_rejects_editing_a_denied_submission(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'osaar001', 'osaar');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');
        DynamoFixtures::submission($db, [
            'status' => 'denied',
        ]);

        $payload = SaafPayload::valid();
        unset($payload['event_id']);

        $this->withStudentAuth()
            ->putJson('/api/v1/students/events/e001/submissions/s001', $payload)
            ->assertUnprocessable();
    }

    public function test_higher_council_submissions_start_at_adviser_and_skip_dean(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, isHigherCouncil: true);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'dean001', 'dean');

        $payload = SaafPayload::valid([
            'activity_classification' => [
                'activity_type' => 'co-curricular',
            ],
        ]);

        $response = $this->withStudentAuth()->postJson('/api/v1/students/submissions', $payload);

        $response->assertCreated()
            ->assertJsonPath('data.current_signatory', 'adv001')
            ->assertJsonPath('data.status', 'pending');

        $submissionId = $response->json('data.submission_id');
        $this->assertIsString($submissionId);
        $stored = $db->find('EVENT#e001', 'SUBMISSION#'.$submissionId);
        $this->assertSame('SIGNATORY#adv001', $stored['GSI2PK'] ?? null);
    }
}
