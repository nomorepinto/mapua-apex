<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class NotificationControllerTest extends TestCase
{
    public function test_returns_401_when_jwt_is_missing(): void
    {
        $this->fakeCognitoJwt();

        $response = $this->getJson('/api/v1/students/events/e001/submissions/s001/notifications');

        $response->assertUnauthorized();
    }

    public function test_returns_notifications_for_a_submission_in_the_jwt_organization(): void
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

        $response = $this->withStudentAuth()->getJson('/api/v1/students/events/e001/submissions/s001/notifications');

        $response->assertOk()
            ->assertJsonPath('data.0.notif_type', 'denied')
            ->assertJsonPath('data.0.comment', 'Budget is incomplete.');
    }

    public function test_creates_a_notification_for_a_submission_in_the_jwt_organization(): void
    {
        $this->freezeTime();
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);

        $response = $this->withStudentAuth()->postJson(
            '/api/v1/students/events/e001/submissions/s001/notifications',
            [
                'signatory' => 'adv001',
                'notif_type' => 'returned',
                'comment' => 'Please revise the venue.',
            ],
        );

        $sentAt = now()->utc()->format('Y-m-d\TH:i:s\Z');

        $response->assertCreated()
            ->assertJsonPath('data.submission_id', 's001')
            ->assertJsonPath('data.sent_at', $sentAt)
            ->assertJsonPath('data.signatory', 'adv001')
            ->assertJsonPath('data.notif_type', 'returned')
            ->assertJsonPath('data.comment', 'Please revise the venue.');

        $stored = $db->find('SUBMISSION#s001', 'NOTIFICATION#'.$sentAt);
        $this->assertSame('SIGNATORY#adv001', $stored['signatory'] ?? null);
        $this->assertSame('returned', $stored['notif_type'] ?? null);
    }

    public function test_returns_422_when_denied_comment_is_missing(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/notifications', [
                'signatory' => 'adv001',
                'notif_type' => 'denied',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['comment']);
    }

    public function test_returns_422_when_the_signatory_does_not_exist(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::submission($db);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/notifications', [
                'signatory' => 'missing',
                'notif_type' => 'approved',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['signatory']);
    }

    public function test_returns_404_when_creating_for_another_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db, 'other-org');
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/notifications', [
                'signatory' => 'adv001',
                'notif_type' => 'approved',
            ])
            ->assertNotFound();
    }

    public function test_updates_a_notification_in_place(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);
        $db->seed([
            'PK' => 'SUBMISSION#s001',
            'SK' => 'NOTIFICATION#2026-09-11T08:30:00Z',
            'signatory' => 'SIGNATORY#adv001',
            'notif_type' => 'denied',
            'comment' => 'Budget is incomplete.',
        ]);

        $response = $this->withStudentAuth()->putJson(
            '/api/v1/students/events/e001/submissions/s001/notifications/2026-09-11T08:30:00Z',
            [
                'signatory' => 'adv001',
                'notif_type' => 'returned',
                'comment' => 'Recalculate grand_total and resubmit.',
            ],
        );

        $response->assertOk()
            ->assertJsonPath('data.sent_at', '2026-09-11T08:30:00Z')
            ->assertJsonPath('data.notif_type', 'returned')
            ->assertJsonPath('data.comment', 'Recalculate grand_total and resubmit.');

        $stored = $db->find('SUBMISSION#s001', 'NOTIFICATION#2026-09-11T08:30:00Z');
        $this->assertSame('returned', $stored['notif_type'] ?? null);
        $this->assertSame('Recalculate grand_total and resubmit.', $stored['comment'] ?? null);
    }

    public function test_returns_404_when_updating_a_missing_notification(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);

        $this->withStudentAuth()
            ->putJson('/api/v1/students/events/e001/submissions/s001/notifications/2026-09-11T08:30:00Z', [
                'signatory' => 'adv001',
                'notif_type' => 'returned',
                'comment' => 'Please revise.',
            ])
            ->assertNotFound();
    }
}
