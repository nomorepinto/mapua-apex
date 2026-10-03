<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Admin;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class AnnouncementControllerTest extends TestCase
{
    public function test_returns_401_when_a_student_jwt_is_used(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withStudentAuth()->getJson('/api/v1/admins/announcements')
            ->assertUnauthorized();
    }

    public function test_returns_401_when_a_signatory_jwt_is_used(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withSignatoryAuth()->getJson('/api/v1/admins/announcements')
            ->assertUnauthorized();
    }

    public function test_lists_announcements_newest_first(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::announcement($db, '2026-09-14T08:00:00Z', 'Older notice.');
        DynamoFixtures::announcement($db, '2026-09-15T08:00:00Z', 'Newer notice.');

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/announcements');

        $response->assertOk()
            ->assertJsonPath('data.0.sent_at', '2026-09-15T08:00:00Z')
            ->assertJsonPath('data.0.content', 'Newer notice.')
            ->assertJsonPath('data.1.sent_at', '2026-09-14T08:00:00Z');
    }

    public function test_shows_one_announcement(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::announcement($db);

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/announcements/2026-09-15T08:00:00Z');

        $response->assertOk()
            ->assertJsonPath('data.sent_at', '2026-09-15T08:00:00Z')
            ->assertJsonPath('data.content', 'OSAAR office hours are 9:00–17:00.');
    }

    public function test_returns_404_when_the_announcement_does_not_exist(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()->getJson('/api/v1/admins/announcements/missing')
            ->assertNotFound();
    }

    public function test_creates_an_announcement(): void
    {
        $this->freezeTime();
        $db = InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/announcements', [
            'content' => 'Campus is closed on Friday.',
        ]);

        $sentAt = now()->utc()->format('Y-m-d\TH:i:s\Z');

        $response->assertCreated()
            ->assertJsonPath('data.sent_at', $sentAt)
            ->assertJsonPath('data.content', 'Campus is closed on Friday.');

        $stored = $db->find('ANNOUNCEMENT', $sentAt);
        $this->assertSame('Campus is closed on Friday.', $stored['content'] ?? null);
    }

    public function test_returns_422_when_content_is_missing(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()
            ->postJson('/api/v1/admins/announcements', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['content']);
    }

    public function test_updates_an_announcement(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::announcement($db);

        $response = $this->withAdminAuth()->putJson('/api/v1/admins/announcements/2026-09-15T08:00:00Z', [
            'content' => 'OSAAR office hours are 10:00–16:00.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.sent_at', '2026-09-15T08:00:00Z')
            ->assertJsonPath('data.content', 'OSAAR office hours are 10:00–16:00.');

        $stored = $db->find('ANNOUNCEMENT', '2026-09-15T08:00:00Z');
        $this->assertSame('OSAAR office hours are 10:00–16:00.', $stored['content'] ?? null);
    }

    public function test_returns_404_when_updating_a_missing_announcement(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()
            ->putJson('/api/v1/admins/announcements/missing', [
                'content' => 'Updated copy.',
            ])
            ->assertNotFound();
    }

    public function test_deletes_an_announcement(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::announcement($db);

        $this->withAdminAuth()
            ->deleteJson('/api/v1/admins/announcements/2026-09-15T08:00:00Z')
            ->assertNoContent();

        $this->assertNull($db->find('ANNOUNCEMENT', '2026-09-15T08:00:00Z'));
    }

    public function test_returns_404_when_deleting_a_missing_announcement(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()
            ->deleteJson('/api/v1/admins/announcements/missing')
            ->assertNotFound();
    }
}
