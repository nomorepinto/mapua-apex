<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class OrganizationControllerTest extends TestCase
{
    public function test_returns_the_jwt_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $response = $this->withStudentAuth()->getJson('/api/v1/students/organization');

        $response->assertOk()
            ->assertJsonPath('data.organization_id', 'a1b2')
            ->assertJsonPath('data.name', 'Mapua Computing Society')
            ->assertJsonPath('data.is_higher_council', false);
    }

    public function test_returns_404_when_the_jwt_organization_does_not_exist(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withStudentAuth()->getJson('/api/v1/students/organization')
            ->assertNotFound();
    }
}
