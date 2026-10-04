<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Signatory;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class SubmissionControllerTest extends TestCase
{
    public function test_returns_401_when_student_jwt_is_used(): void
    {
        $response = $this->withStudentAuth()->getJson('/api/v1/signatories/submissions');

        $response->assertUnauthorized();
    }

    public function test_defaults_to_campus_desk_when_admin_omits_signatory(): void
    {
        InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth()->getJson('/api/v1/signatories/submissions');

        $response->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_lists_the_queue_when_admin_sends_a_signatory_header(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::submission($db);

        $response = $this->withAdminAuth()
            ->withHeaders(['X-Signatory-Id' => 'adv001'])
            ->getJson('/api/v1/signatories/submissions');

        $response->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_lists_the_queue_when_osaar_sends_a_signatory_header(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::submission($db);

        $response = $this->withAdminAuth(['cognito:groups' => ['osaar']])
            ->withHeaders(['X-Signatory-Id' => 'adv001'])
            ->getJson('/api/v1/signatories/submissions');

        $response->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_returns_401_when_signatory_claim_is_missing(): void
    {
        $response = $this->withSignatoryAuth([
            'custom:signatory_id' => '',
        ])->getJson('/api/v1/signatories/submissions');

        $response->assertUnauthorized();
    }

    public function test_lists_submissions_when_signatory_id_claim_has_no_custom_prefix(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::submission($db);

        $response = $this->withSignatoryAuth([
            'custom:signatory_id' => '',
            'signatory_id' => 'adv001',
        ])->getJson('/api/v1/signatories/submissions');

        $response->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_lists_submissions_on_the_signatory_queue(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::submission($db);

        $response = $this->withSignatoryAuth()->getJson('/api/v1/signatories/submissions');

        $response->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001');
    }

    public function test_returns_404_when_the_submission_is_not_on_the_signatory_desk(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db, [
            'current_signatory' => 'SIGNATORY#cdm001',
            'GSI2PK' => 'SIGNATORY#cdm001',
        ]);

        $response = $this->withSignatoryAuth()->getJson('/api/v1/signatories/events/e001/submissions/s001');

        $response->assertNotFound();
    }

    public function test_approve_advances_to_osaar_for_extra_curricular_venue_events(): void
    {
        $this->freezeTime();
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'osaar001', 'osaar');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');
        DynamoFixtures::submission($db);

        $response = $this->withSignatoryAuth()->postJson('/api/v1/signatories/events/e001/submissions/s001/approve');

        $response->assertOk()
            ->assertJsonPath('data.current_signatory', 'osaar001');

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('SIGNATORY#osaar001', $stored['GSI2PK'] ?? null);
        $this->assertNotNull($db->find('SUBMISSION#s001', 'NOTIFICATION#'.now()->utc()->format('Y-m-d\TH:i:s\Z')));
    }

    public function test_approve_skips_dean_for_higher_council_co_curricular_events(): void
    {
        $this->freezeTime();
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, isHigherCouncil: true);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'dean001', 'dean');
        DynamoFixtures::signatory($db, 'osaar001', 'osaar');
        DynamoFixtures::submission($db, [
            'activity_classification' => [
                'activity_type' => 'co-curricular',
                'total_org_members' => 42,
            ],
        ]);

        $response = $this->withSignatoryAuth()->postJson('/api/v1/signatories/events/e001/submissions/s001/approve');

        $response->assertOk()
            ->assertJsonPath('data.current_signatory', 'osaar001');

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('SIGNATORY#osaar001', $stored['GSI2PK'] ?? null);
    }

    public function test_return_requires_a_comment_and_keeps_the_gsi2_queue_entry(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/return', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comment']);

        $response = $this->withSignatoryAuth()->postJson('/api/v1/signatories/events/e001/submissions/s001/return', [
            'comment' => 'Please revise the budget.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'returned');

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('SIGNATORY#adv001', $stored['GSI2PK'] ?? null);
        $this->assertSame('returned', $stored['status'] ?? null);
    }

    public function test_deny_requires_a_comment_and_drops_the_gsi2_queue_entry(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/deny', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comment']);

        $response = $this->withSignatoryAuth()->postJson('/api/v1/signatories/events/e001/submissions/s001/deny', [
            'comment' => 'Budget is incomplete.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'denied');

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertArrayNotHasKey('GSI2PK', $stored ?? []);
    }

    public function test_returned_submissions_remain_on_the_signatory_queue(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db, [
            'status' => 'returned',
        ]);

        $response = $this->withSignatoryAuth()->getJson('/api/v1/signatories/submissions');

        $response->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001')
            ->assertJsonPath('data.0.status', 'returned');
    }

    public function test_updates_event_classification_major_or_minor(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db, [
            'activity_classification' => [
                'activity_type' => 'extra-curricular',
                'total_org_members' => 30,
                'nature' => 'minor',
            ],
        ]);

        $response = $this->withSignatoryAuth()->patchJson('/api/v1/signatories/events/e001/submissions/s001/classification', [
            'nature' => 'major',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.activity_classification.nature', 'major');

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('major', $stored['activity_classification']['nature'] ?? null);
    }

    public function test_approve_walks_the_stored_signatory_sequence(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        // The stored list deliberately skips OSAAR, so advancing to CDM proves
        // the hop reads signatory_sequence rather than recomputing it.
        DynamoFixtures::submission($db, [
            'current_signatory' => 'SIGNATORY#adv001',
            'GSI2PK' => 'SIGNATORY#adv001',
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#cdm001'],
        ]);

        $response = $this->withSignatoryAuth()->postJson('/api/v1/signatories/events/e001/submissions/s001/approve');

        $response->assertOk()
            ->assertJsonPath('data.current_signatory', 'cdm001')
            ->assertJsonPath('data.signatory_sequence', ['adv001', 'cdm001']);

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('SIGNATORY#cdm001', $stored['GSI2PK'] ?? null);
        $this->assertSame(['SIGNATORY#adv001', 'SIGNATORY#cdm001'], $stored['signatory_sequence'] ?? null);
    }

    public function test_approve_backfills_a_missing_signatory_sequence(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'osaar001', 'osaar');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');
        DynamoFixtures::submission($db); // legacy item: no signatory_sequence

        $response = $this->withSignatoryAuth()->postJson('/api/v1/signatories/events/e001/submissions/s001/approve');

        $response->assertOk()
            ->assertJsonPath('data.current_signatory', 'osaar001');

        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame(
            ['SIGNATORY#adv001', 'SIGNATORY#osaar001', 'SIGNATORY#cdm001'],
            $stored['signatory_sequence'] ?? null,
        );
    }

    public function test_approve_returns_404_when_the_desk_is_not_in_the_stored_sequence(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db, [
            'current_signatory' => 'SIGNATORY#adv001',
            'GSI2PK' => 'SIGNATORY#adv001',
            'signatory_sequence' => ['SIGNATORY#osaar001', 'SIGNATORY#cdm001'],
        ]);

        $response = $this->withSignatoryAuth()->postJson('/api/v1/signatories/events/e001/submissions/s001/approve');

        $response->assertNotFound();
    }
}
