<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class MemberControllerTest extends TestCase
{
    public function test_index_returns_members_for_jwt_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::organizationMember($db, '202100001');
        DynamoFixtures::organizationMember($db, '202100002', lastName: 'Santos', firstName: 'Maria');

        $response = $this->withStudentAuth()->getJson('/api/v1/students/members');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.student_number', '202100001')
            ->assertJsonPath('data.0.lastname', 'Dela Cruz')
            ->assertJsonPath('data.0.firstname', 'Juan')
            ->assertJsonPath('data.1.student_number', '202100002')
            ->assertJsonPath('data.1.lastname', 'Santos')
            ->assertJsonPath('data.1.firstname', 'Maria');
    }

    public function test_index_returns_empty_list_when_no_members(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $this->withStudentAuth()->getJson('/api/v1/students/members')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_store_creates_a_member(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $response = $this->withStudentAuth()->postJson('/api/v1/students/members', [
            'student_number' => '202100003',
            'lastname' => 'Reyes',
            'firstname' => 'Pedro',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.student_number', '202100003')
            ->assertJsonPath('data.lastname', 'Reyes')
            ->assertJsonPath('data.firstname', 'Pedro');

        $this->assertNotNull($db->find('ORGANIZATION#a1b2', 'MEMBER#202100003'));
    }

    public function test_store_returns_409_for_duplicate_member(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::organizationMember($db, '202100001');

        $this->withStudentAuth()->postJson('/api/v1/students/members', [
            'student_number' => '202100001',
            'lastname' => 'Dela Cruz',
            'firstname' => 'Juan',
        ])->assertConflict();
    }

    public function test_store_validates_required_fields(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withStudentAuth()->postJson('/api/v1/students/members', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['student_number', 'lastname', 'firstname']);
    }

    public function test_bulk_store_creates_multiple_members(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $response = $this->withStudentAuth()->postJson('/api/v1/students/members/bulk', [
            'members' => [
                ['student_number' => '202100010', 'lastname' => 'A', 'firstname' => 'B'],
                ['student_number' => '202100011', 'lastname' => 'C', 'firstname' => 'D'],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonCount(2, 'created')
            ->assertJsonCount(0, 'failed');

        $this->assertNotNull($db->find('ORGANIZATION#a1b2', 'MEMBER#202100010'));
        $this->assertNotNull($db->find('ORGANIZATION#a1b2', 'MEMBER#202100011'));
    }

    public function test_bulk_store_reports_duplicates_as_failed(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::organizationMember($db, '202100010');

        $response = $this->withStudentAuth()->postJson('/api/v1/students/members/bulk', [
            'members' => [
                ['student_number' => '202100010', 'lastname' => 'A', 'firstname' => 'B'],
                ['student_number' => '202100011', 'lastname' => 'C', 'firstname' => 'D'],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonCount(1, 'created')
            ->assertJsonCount(1, 'failed')
            ->assertJsonPath('failed.0.student_number', '202100010');
    }

    public function test_update_patches_member_name(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::organizationMember($db, '202100001');

        $response = $this->withStudentAuth()->putJson('/api/v1/students/members/202100001', [
            'lastname' => 'Updated',
            'firstname' => 'Name',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.lastname', 'Updated')
            ->assertJsonPath('data.firstname', 'Name');

        $item = $db->find('ORGANIZATION#a1b2', 'MEMBER#202100001');
        $this->assertSame('Updated', $item['lastname']);
        $this->assertSame('Name', $item['firstname']);
    }

    public function test_update_returns_404_for_missing_member(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $this->withStudentAuth()->putJson('/api/v1/students/members/9999999', [
            'lastname' => 'X',
            'firstname' => 'Y',
        ])->assertNotFound();
    }

    public function test_destroy_removes_member(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::organizationMember($db, '202100001');

        $this->withStudentAuth()->deleteJson('/api/v1/students/members/202100001')
            ->assertNoContent();

        $this->assertNull($db->find('ORGANIZATION#a1b2', 'MEMBER#202100001'));
    }

    public function test_destroy_returns_404_for_missing_member(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $this->withStudentAuth()->deleteJson('/api/v1/students/members/9999999')
            ->assertNotFound();
    }
}
