<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Public;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class OrganizationControllerTest extends TestCase
{
    public function test_lists_organizations_without_authentication(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $response = $this->getJson('/api/v1/public/organizations');

        $response->assertOk()
            ->assertExactJson([
                'data' => [[
                    'organization_id' => 'a1b2',
                    'name' => 'Mapua Computing Society',
                ]],
            ]);
    }

    public function test_returns_an_empty_list_when_none_exist(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->getJson('/api/v1/public/organizations')
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }
}
