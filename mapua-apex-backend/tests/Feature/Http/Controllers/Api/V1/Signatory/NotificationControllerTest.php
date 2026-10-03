<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Signatory;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class NotificationControllerTest extends TestCase
{
    public function test_creates_a_notification_on_the_open_desk(): void
    {
        $this->freezeTime();
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);

        $response = $this->withSignatoryAuth()->postJson(
            '/api/v1/signatories/events/e001/submissions/s001/notifications',
            [
                'notif_type' => 'returned',
                'comment' => 'Please revise the budget.',
            ],
        );

        $sentAt = now()->utc()->format('Y-m-d\TH:i:s\Z');

        $response->assertCreated()
            ->assertJsonPath('data.signatory', 'adv001')
            ->assertJsonPath('data.notif_type', 'returned')
            ->assertJsonPath('data.comment', 'Please revise the budget.');

        $paper = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertSame('pending', $paper['status'] ?? null);
        $this->assertSame('SIGNATORY#adv001', $paper['GSI2PK'] ?? null);
        $this->assertNotNull($db->find('SUBMISSION#s001', 'NOTIFICATION#'.$sentAt));
    }

    public function test_returns_404_when_the_paper_is_not_on_the_signatory_desk(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db, [
            'current_signatory' => 'SIGNATORY#cdm001',
            'GSI2PK' => 'SIGNATORY#cdm001',
        ]);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/notifications', [
                'notif_type' => 'returned',
                'comment' => 'Please revise.',
            ])
            ->assertNotFound();
    }

    public function test_stamps_the_jwt_signatory_and_ignores_a_body_signatory(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);

        $this->withSignatoryAuth()->postJson(
            '/api/v1/signatories/events/e001/submissions/s001/notifications',
            [
                'signatory' => 'cdm001',
                'notif_type' => 'approved',
            ],
        )->assertCreated()
            ->assertJsonPath('data.signatory', 'adv001')
            ->assertJsonPath('data.comment', '');
    }

    public function test_updates_a_notification_the_signatory_authored(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);
        $db->seed([
            'PK' => 'SUBMISSION#s001',
            'SK' => 'NOTIFICATION#2026-09-11T08:30:00Z',
            'signatory' => 'SIGNATORY#adv001',
            'notif_type' => 'denied',
            'comment' => 'Budget is incomplete.',
        ]);

        $response = $this->withSignatoryAuth()->putJson(
            '/api/v1/signatories/events/e001/submissions/s001/notifications/2026-09-11T08:30:00Z',
            [
                'notif_type' => 'returned',
                'comment' => 'Recalculate grand_total.',
            ],
        );

        $response->assertOk()
            ->assertJsonPath('data.sent_at', '2026-09-11T08:30:00Z')
            ->assertJsonPath('data.signatory', 'adv001')
            ->assertJsonPath('data.notif_type', 'returned')
            ->assertJsonPath('data.comment', 'Recalculate grand_total.');
    }

    public function test_returns_404_when_updating_another_signatory_notification(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);
        $db->seed([
            'PK' => 'SUBMISSION#s001',
            'SK' => 'NOTIFICATION#2026-09-11T08:30:00Z',
            'signatory' => 'SIGNATORY#cdm001',
            'notif_type' => 'returned',
            'comment' => 'Need more chairs.',
        ]);

        $this->withSignatoryAuth()
            ->putJson('/api/v1/signatories/events/e001/submissions/s001/notifications/2026-09-11T08:30:00Z', [
                'notif_type' => 'returned',
                'comment' => 'Edited by the wrong desk.',
            ])
            ->assertNotFound();
    }
}
