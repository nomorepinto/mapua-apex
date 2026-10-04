<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\Support\SaafPayload;
use Tests\TestCase;

class CollaborationSubmissionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        InMemoryDynamoDb::bind($this);
    }

    public function test_create_stores_the_collaboration_and_a_dependent_pointer(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
        ]);
        DynamoFixtures::organization($db, 'dep1', 'Dependent One', [
            ['role' => 'adviser', 'signatory_id' => 'adv002'],
        ]);

        $response = $this->withStudentAuth()->postJson(
            '/api/v1/students/submissions',
            SaafPayload::valid([
                'collaboration' => ['dependent_organization_ids' => ['dep1']],
            ]),
        );

        $response->assertCreated()
            ->assertJsonPath('data.role', 'proponent')
            ->assertJsonPath('data.collaboration.dependent_organization_ids', ['dep1']);

        $submissionId = $response->json('data.submission_id');
        $this->assertIsString($submissionId);

        $stored = $db->find('EVENT#e001', 'SUBMISSION#'.$submissionId);
        $this->assertSame(['ORGANIZATION#dep1'], $stored['collaboration']['dependent_organization_ids'] ?? null);

        $pointer = $db->find('ORGANIZATION#dep1', 'COLLAB#e001#'.$submissionId);
        $this->assertNotNull($pointer);
        $this->assertSame('e001', $pointer['event_id'] ?? null);
        $this->assertSame($submissionId, $pointer['submission_id'] ?? null);
    }

    public function test_create_rejects_an_unknown_dependent_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
        ]);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/submissions', SaafPayload::valid([
                'collaboration' => ['dependent_organization_ids' => ['ghost']],
            ]))
            ->assertUnprocessable();
    }

    public function test_a_dependent_can_read_the_shared_submission(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, org: 'a1b2');
        DynamoFixtures::submission($db, [
            'collaboration' => ['dependent_organization_ids' => ['ORGANIZATION#dep1']],
        ]);

        $this->withStudentAuth(['custom:organization_id' => 'dep1'])
            ->getJson('/api/v1/students/events/e001/submissions/s001')
            ->assertOk()
            ->assertJsonPath('data.submission_id', 's001')
            ->assertJsonPath('data.role', 'dependent');
    }

    public function test_an_unrelated_organization_gets_404(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, org: 'a1b2');
        DynamoFixtures::submission($db, [
            'collaboration' => ['dependent_organization_ids' => ['ORGANIZATION#dep1']],
        ]);

        $this->withStudentAuth(['custom:organization_id' => 'stranger'])
            ->getJson('/api/v1/students/events/e001/submissions/s001')
            ->assertNotFound();
    }

    public function test_a_dependent_can_read_the_shared_notifications(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, org: 'a1b2');
        DynamoFixtures::submission($db, [
            'collaboration' => ['dependent_organization_ids' => ['ORGANIZATION#dep1']],
        ]);

        $this->withStudentAuth(['custom:organization_id' => 'dep1'])
            ->getJson('/api/v1/students/events/e001/submissions/s001/notifications')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_a_dependent_cannot_edit_but_the_proponent_can(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
        ]);
        DynamoFixtures::organization($db, 'dep1', 'Dependent One', [
            ['role' => 'adviser', 'signatory_id' => 'adv002'],
        ]);
        DynamoFixtures::event($db, org: 'a1b2');
        DynamoFixtures::submission($db, [
            'status' => 'returned',
            'collaboration' => ['dependent_organization_ids' => ['ORGANIZATION#dep1']],
        ]);

        $payload = SaafPayload::valid();
        unset($payload['event_id']);

        $this->withStudentAuth(['custom:organization_id' => 'dep1'])
            ->putJson('/api/v1/students/events/e001/submissions/s001', $payload)
            ->assertNotFound();

        $this->withStudentAuth()
            ->putJson('/api/v1/students/events/e001/submissions/s001', $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'pending');
    }

    public function test_the_index_tags_proponent_and_dependent_rows(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, org: 'a1b2');
        DynamoFixtures::submission($db, [
            'collaboration' => ['dependent_organization_ids' => ['ORGANIZATION#dep1']],
        ]);
        $db->seed([
            'PK' => 'ORGANIZATION#dep1',
            'SK' => 'COLLAB#e001#s001',
            'event_id' => 'e001',
            'submission_id' => 's001',
            'sent_at' => '2026-09-10T14:00:00Z',
        ]);

        // Proponent sees its own paper tagged as proponent.
        $this->withStudentAuth()
            ->getJson('/api/v1/students/submissions')
            ->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001')
            ->assertJsonPath('data.0.role', 'proponent');

        // Dependent sees the shared paper tagged as dependent.
        $this->withStudentAuth(['custom:organization_id' => 'dep1'])
            ->getJson('/api/v1/students/submissions')
            ->assertOk()
            ->assertJsonPath('data.0.submission_id', 's001')
            ->assertJsonPath('data.0.role', 'dependent');
    }

    public function test_the_organization_directory_lists_id_and_name(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent');
        DynamoFixtures::organization($db, 'dep1', 'Dependent One');

        $this->withStudentAuth()
            ->getJson('/api/v1/students/organizations')
            ->assertOk()
            ->assertJsonPath('data.0.organization_id', 'a1b2')
            ->assertJsonPath('data.0.name', 'Proponent');
    }
}
