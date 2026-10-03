<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Signatory;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class ProfileControllerTest extends TestCase
{
    public function test_returns_the_jwt_signatory(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');

        $response = $this->withSignatoryAuth()->getJson('/api/v1/signatories/me');

        $response->assertOk()
            ->assertJsonPath('data.signatory_id', 'adv001')
            ->assertJsonPath('data.role', 'adviser')
            ->assertJsonPath('data.name', 'Prof. Juan Dela Cruz');
    }

    public function test_returns_404_when_the_jwt_signatory_does_not_exist(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withSignatoryAuth()->getJson('/api/v1/signatories/me')
            ->assertNotFound();
    }
}
