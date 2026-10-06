<?php

namespace Tests\Feature\Support\Email;

use Tests\Fakes\FakeEmailSender;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\Support\SaafPayload;
use Tests\TestCase;

class SubmissionEmailTest extends TestCase
{
    private FakeEmailSender $mailer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mailer = $this->fakeEmailSender();
    }

    public function test_creating_a_submission_emails_the_first_signatory(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');

        $this->withStudentAuth()->postJson('/api/v1/students/submissions', SaafPayload::valid())
            ->assertCreated();

        $this->assertCount(1, $this->mailer->sent());
        $mail = $this->mailer->to('adv001@mapua.edu.ph')[0] ?? null;
        $this->assertNotNull($mail);
        $this->assertStringContainsString('Mapua Computing Society', $mail['body']);
        $this->assertStringContainsString('Hack Night: Intro to Web Dev', $mail['body']);
    }

    public function test_mid_chain_approval_emails_the_student_and_the_next_signatory(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db, [
            'current_signatory' => 'SIGNATORY#adv001',
            'GSI2PK' => 'SIGNATORY#adv001',
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#osaar001'],
        ]);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/approve')
            ->assertOk();

        $this->assertCount(2, $this->mailer->sent());

        $student = $this->mailer->to('nsantos@mymail.mapua.edu.ph')[0] ?? null;
        $this->assertNotNull($student);
        $this->assertStringContainsString('Prof. Juan Dela Cruz', $student['subject']);

        $next = $this->mailer->to('osaar001@mapua.edu.ph')[0] ?? null;
        $this->assertNotNull($next);
        $this->assertStringContainsString('Mapua Computing Society', $next['body']);
    }

    public function test_final_approval_emails_only_the_student(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db, [
            'current_signatory' => 'SIGNATORY#adv001',
            'GSI2PK' => 'SIGNATORY#adv001',
            'signatory_sequence' => ['SIGNATORY#adv001'],
        ]);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/approve')
            ->assertOk();

        $this->assertCount(1, $this->mailer->sent());
        $mail = $this->mailer->to('nsantos@mymail.mapua.edu.ph')[0] ?? null;
        $this->assertNotNull($mail);
        $this->assertStringContainsString('fully approved', $mail['subject']);
    }

    public function test_deny_emails_the_student_with_the_comment(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/deny', [
                'comment' => 'Budget is unrealistic.',
            ])
            ->assertOk();

        $this->assertCount(1, $this->mailer->sent());
        $mail = $this->mailer->to('nsantos@mymail.mapua.edu.ph')[0] ?? null;
        $this->assertNotNull($mail);
        $this->assertStringContainsString('denied', $mail['subject']);
        $this->assertStringContainsString('Budget is unrealistic.', $mail['body']);
    }

    public function test_return_emails_the_student_with_the_comment(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/return', [
                'comment' => 'Please revise the venue.',
            ])
            ->assertOk();

        $this->assertCount(1, $this->mailer->sent());
        $mail = $this->mailer->to('nsantos@mymail.mapua.edu.ph')[0] ?? null;
        $this->assertNotNull($mail);
        $this->assertStringContainsString('returned for revision', $mail['subject']);
        $this->assertStringContainsString('Please revise the venue.', $mail['body']);
    }

    public function test_resubmitting_a_returned_paper_emails_the_desk_it_sits_on(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');
        DynamoFixtures::submission($db, [
            'status' => 'returned',
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#cdm001'],
        ]);

        $this->withStudentAuth()
            ->putJson('/api/v1/students/events/e001/submissions/s001', SaafPayload::valid())
            ->assertOk();

        $this->assertCount(1, $this->mailer->sent());
        $mail = $this->mailer->to('adv001@mapua.edu.ph')[0] ?? null;
        $this->assertNotNull($mail);
        $this->assertStringContainsString('resubmitted', $mail['body']);
    }

    public function test_editing_a_pending_paper_sends_no_email(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm');
        DynamoFixtures::submission($db, [
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#cdm001'],
        ]);

        $this->withStudentAuth()
            ->putJson('/api/v1/students/events/e001/submissions/s001', SaafPayload::valid())
            ->assertOk();

        $this->assertCount(0, $this->mailer->sent());
    }

    public function test_a_signatory_desk_notification_emails_the_student(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/notifications', [
                'notif_type' => 'returned',
                'comment' => 'Please revise the budget.',
            ])
            ->assertCreated();

        $this->assertCount(1, $this->mailer->sent());
        $mail = $this->mailer->to('nsantos@mymail.mapua.edu.ph')[0] ?? null;
        $this->assertNotNull($mail);
        $this->assertStringContainsString('Please revise the budget.', $mail['body']);
    }

    public function test_a_student_authored_notification_emails_the_student(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/events/e001/submissions/s001/notifications', [
                'signatory' => 'adv001',
                'notif_type' => 'returned',
                'comment' => 'Following up on the revision.',
            ])
            ->assertCreated();

        $this->assertCount(1, $this->mailer->sent());
        $this->assertCount(1, $this->mailer->to('nsantos@mymail.mapua.edu.ph'));
    }

    public function test_updating_a_notification_sends_no_email(): void
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

        $this->withSignatoryAuth()
            ->putJson('/api/v1/signatories/events/e001/submissions/s001/notifications/2026-09-11T08:30:00Z', [
                'notif_type' => 'returned',
                'comment' => 'Recalculate grand_total.',
            ])
            ->assertOk();

        $this->assertCount(0, $this->mailer->sent());
    }

    public function test_an_unresolvable_signatory_email_never_fails_the_request(): void
    {
        $this->fakeSignatoryEmails([]);
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::submission($db, [
            'current_signatory' => 'SIGNATORY#adv001',
            'GSI2PK' => 'SIGNATORY#adv001',
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#osaar001'],
        ]);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/approve')
            ->assertOk();

        // Both desk emails are skipped, but the student email still goes out.
        $this->assertCount(1, $this->mailer->sent());
        $this->assertCount(1, $this->mailer->to('nsantos@mymail.mapua.edu.ph'));
    }
}
