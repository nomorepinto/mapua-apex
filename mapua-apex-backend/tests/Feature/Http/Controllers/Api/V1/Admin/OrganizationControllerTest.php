<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Admin;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class OrganizationControllerTest extends TestCase
{
    public function test_lists_organizations(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/organizations');

        $response->assertOk()
            ->assertJsonPath('data.0.organization_id', 'a1b2')
            ->assertJsonPath('data.0.name', 'Mapua Computing Society')
            ->assertJsonPath('data.0.is_higher_council', false)
            ->assertJsonPath('data.0.signatories', []);
    }

    public function test_lists_organizations_for_the_osaar_group(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $response = $this->withAdminAuth([
            'cognito:groups' => ['osaar'],
        ])->getJson('/api/v1/admins/organizations');

        $response->assertOk()
            ->assertJsonPath('data.0.organization_id', 'a1b2');
    }

    public function test_creates_an_organization_for_the_osaar_group(): void
    {
        InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth([
            'cognito:groups' => ['osaar'],
        ])->postJson('/api/v1/admins/organizations', [
            'name' => 'IEEE Mapua',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'IEEE Mapua');
    }

    public function test_creates_an_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/organizations', [
            'name' => 'IEEE Mapua',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'IEEE Mapua')
            ->assertJsonPath('data.is_higher_council', false)
            ->assertJsonPath('data.signatories', []);

        $id = $response->json('data.organization_id');
        $this->assertIsString($id);
        $this->assertNotNull($db->find('ORGANIZATION#'.$id, 'ORGANIZATION#'.$id));
    }

    public function test_creates_an_organization_with_signatory_desks(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/organizations', [
            'name' => 'IEEE Mapua',
            'signatories' => [
                ['role' => 'cdm', 'signatory_id' => 'cdm001'],
                ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'IEEE Mapua')
            ->assertJsonPath('data.signatories.0.role', 'adviser')
            ->assertJsonPath('data.signatories.0.signatory_id', 'adv001')
            ->assertJsonPath('data.signatories.1.role', 'cdm')
            ->assertJsonPath('data.signatories.1.signatory_id', 'cdm001');

        $id = $response->json('data.organization_id');
        $this->assertIsString($id);

        $stored = $db->find('ORGANIZATION#'.$id, 'ORGANIZATION#'.$id);
        $this->assertSame([
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'cdm', 'signatory_id' => 'cdm001'],
        ], $stored['signatories'] ?? null);
    }

    public function test_returns_422_when_a_signatory_desk_does_not_exist(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()
            ->postJson('/api/v1/admins/organizations', [
                'name' => 'IEEE Mapua',
                'signatories' => [
                    ['role' => 'adviser', 'signatory_id' => 'missing'],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['signatories.0.signatory_id']);
    }

    public function test_lists_organization_signatory_desks(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/organizations');

        $response->assertOk()
            ->assertJsonPath('data.0.signatories.0.role', 'adviser')
            ->assertJsonPath('data.0.signatories.0.signatory_id', 'adv001');
    }

    public function test_returns_422_when_name_is_missing(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()
            ->postJson('/api/v1/admins/organizations', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_updates_an_organization_name_and_desks(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'dean001', 'dean');

        $response = $this->withAdminAuth()->putJson('/api/v1/admins/organizations/a1b2', [
            'name' => 'IEEE Mapua',
            'signatories' => [
                ['role' => 'dean', 'signatory_id' => 'dean001'],
                ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.organization_id', 'a1b2')
            ->assertJsonPath('data.name', 'IEEE Mapua')
            ->assertJsonPath('data.signatories.0.role', 'adviser')
            ->assertJsonPath('data.signatories.0.signatory_id', 'adv001')
            ->assertJsonPath('data.signatories.1.role', 'dean')
            ->assertJsonPath('data.signatories.1.signatory_id', 'dean001');

        $stored = $db->find('ORGANIZATION#a1b2', 'ORGANIZATION#a1b2');
        $this->assertSame('IEEE Mapua', $stored['name'] ?? null);
        $this->assertSame([
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'dean', 'signatory_id' => 'dean001'],
        ], $stored['signatories'] ?? null);
    }

    public function test_returns_404_when_the_organization_id_does_not_exist(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()
            ->putJson('/api/v1/admins/organizations/missing', [
                'name' => 'IEEE Mapua',
                'signatories' => [],
            ])
            ->assertNotFound();
    }

    public function test_creates_an_organization_as_a_higher_council(): void
    {
        $db = InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/organizations', [
            'name' => 'Central Student Council',
            'is_higher_council' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Central Student Council')
            ->assertJsonPath('data.is_higher_council', true);

        $id = $response->json('data.organization_id');
        $this->assertIsString($id);
        $stored = $db->find('ORGANIZATION#'.$id, 'ORGANIZATION#'.$id);
        $this->assertTrue($stored['is_higher_council'] ?? false);
    }

    public function test_updates_is_higher_council_and_keeps_it_when_omitted(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $this->withAdminAuth()
            ->putJson('/api/v1/admins/organizations/a1b2', [
                'name' => 'Mapua Computing Society',
                'signatories' => [],
                'is_higher_council' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.is_higher_council', true);

        $this->withAdminAuth()
            ->putJson('/api/v1/admins/organizations/a1b2', [
                'name' => 'Mapua Computing Society',
                'signatories' => [],
            ])
            ->assertOk()
            ->assertJsonPath('data.is_higher_council', true);

        $stored = $db->find('ORGANIZATION#a1b2', 'ORGANIZATION#a1b2');
        $this->assertTrue($stored['is_higher_council'] ?? false);
    }
}
