<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Public;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class AnnouncementControllerTest extends TestCase
{
    public function test_lists_announcements_newest_first_without_authentication(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::announcement($db, '2026-09-14T08:00:00Z', 'Older notice.');
        DynamoFixtures::announcement($db, '2026-09-15T08:00:00Z', 'Newer notice.');

        $response = $this->getJson('/api/v1/public/announcements');

        $response->assertOk()
            ->assertJsonPath('data.0.sent_at', '2026-09-15T08:00:00Z')
            ->assertJsonPath('data.0.content', 'Newer notice.')
            ->assertJsonPath('data.1.sent_at', '2026-09-14T08:00:00Z');
    }

    public function test_returns_an_empty_list_when_none_exist(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->getJson('/api/v1/public/announcements')
            ->assertOk()
            ->assertJsonPath('data', []);
    }
}
