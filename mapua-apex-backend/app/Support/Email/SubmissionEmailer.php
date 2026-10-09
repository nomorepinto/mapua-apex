<?php

namespace App\Support\Email;

use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\GetEvent;
use App\Aws\DynamoDb\OrganizationRecords;
use App\Aws\DynamoDb\SignatoryRecords;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Best-effort transactional emails around the submission lifecycle. Every
 * method swallows its own failures: an unresolvable address, org name, or
 * SES outage must never fail the API request that triggered it.
 */
final class SubmissionEmailer
{
    public function __construct(
        private EmailSender $mailer,
        private CognitoSignatoryEmails $signatoryEmails,
        private OrganizationRecords $organizations,
        private SignatoryRecords $signatories,
        private GetEvent $events,
    ) {}

    /**
     * Student just created a submission: notify the first desk in the chain.
     *
     * @param  array<string, mixed>  $submission
     */
    public function submitted(array $submission): void
    {
        $this->guard(__FUNCTION__, function () use ($submission): void {
            $sequence = $submission['signatory_sequence'] ?? null;
            $first = is_array($sequence) && isset($sequence[0]) && is_string($sequence[0]) ? $sequence[0] : null;

            if ($first !== null) {
                $this->sendNewSubmissionNotice($first, $submission);
            }
        });
    }

    /**
     * Student resubmitted a returned paper: notify the desk it now sits on.
     *
     * @param  array<string, mixed>  $submission
     */
    public function resubmitted(array $submission): void
    {
        $this->guard(__FUNCTION__, function () use ($submission): void {
            $desk = $submission['current_signatory'] ?? null;

            if (is_string($desk) && $desk !== '') {
                $this->sendResubmittedNotice($desk, $submission);
            }
        });
    }

    /**
     * One email per NOTIFICATION row written through NotificationRecords::create.
     * Decision types email the student; a mid-chain approval also routes the
     * "new submission" notice to the next desk.
     *
     * @param  array<string, mixed>  $submission
     */
    public function notificationCreated(array $submission, string $signatoryId, string $notifType, string $comment): void
    {
        $this->guard(__FUNCTION__, function () use ($submission, $signatoryId, $notifType, $comment): void {
            match ($notifType) {
                'approved' => $this->notifyStudentApproved($submission, $signatoryId),
                'fully approved' => $this->notifyStudentFinal($submission),
                'denied' => $this->notifyStudentDecision($submission, $signatoryId, $comment, denied: true),
                'returned' => $this->notifyStudentDecision($submission, $signatoryId, $comment, denied: false),
                default => $this->notifyStudentDeskReminder($submission, $signatoryId, $notifType, $comment),
            };

            if ($notifType === 'approved' && ($submission['status'] ?? null) === 'pending') {
                $next = $this->nextSignatoryKey($submission, $signatoryId);

                if ($next !== null) {
                    $this->sendNewSubmissionNotice($next, $submission);
                }
            }
        });
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function notifyStudentApproved(array $submission, string $signatoryId): void
    {
        $email = $this->studentEmail($submission);

        if ($email === null) {
            return;
        }

        $this->mailer->send(
            $email,
            'Your submission was approved by '.$this->signatoryName($signatoryId),
            $this->signatoryName($signatoryId).' has approved your submission for "'
                .$this->activityTitle($submission).'".'."\n\n"
                .'It now moves to the next signatory for review.',
        );
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function notifyStudentFinal(array $submission): void
    {
        $email = $this->studentEmail($submission);

        if ($email === null) {
            return;
        }

        $this->mailer->send(
            $email,
            'Your submission has been fully approved',
            'Your submission for "'.$this->activityTitle($submission).'" has been fully approved by the final signatory.',
        );
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function notifyStudentDecision(array $submission, string $signatoryId, string $comment, bool $denied): void
    {
        $email = $this->studentEmail($submission);

        if ($email === null) {
            return;
        }

        $what = $denied ? 'denied' : 'returned for revision';
        $body = $this->signatoryName($signatoryId).' has '.$what.' your submission for "'
            .$this->activityTitle($submission).'".';

        if ($comment !== '') {
            $body .= "\n\nComment: ".$comment;
        }

        $this->mailer->send(
            $email,
            $denied ? 'Your submission was denied' : 'Your submission was returned for revision',
            $body,
        );
    }

    /**
     * A signatory posted a reminder/notice row directly on the desk; relay it to the student.
     *
     * @param  array<string, mixed>  $submission
     */
    private function notifyStudentDeskReminder(array $submission, string $signatoryId, string $notifType, string $comment): void
    {
        $email = $this->studentEmail($submission);

        if ($email === null) {
            return;
        }

        $body = 'You received a "'.$notifType.'" notice from '.$this->signatoryName($signatoryId)
            .' regarding your submission for "'.$this->activityTitle($submission).'".';

        if ($comment !== '') {
            $body .= "\n\nMessage: ".$comment;
        }

        $this->mailer->send($email, 'Notice from '.$this->signatoryName($signatoryId), $body);
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function sendNewSubmissionNotice(string $signatoryKey, array $submission): void
    {
        $email = $this->signatoryEmail($signatoryKey);

        if ($email === null) {
            return;
        }

        $this->mailer->send(
            $email,
            'New event submission awaiting your review',
            'You have received an event submission from '.$this->organizationName($submission)
                .' for "'.$this->activityTitle($submission).'".'."\n\n"
                .'Sign in to the APEX signatory dashboard to review it.',
        );
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function sendResubmittedNotice(string $signatoryKey, array $submission): void
    {
        $email = $this->signatoryEmail($signatoryKey);

        if ($email === null) {
            return;
        }

        $this->mailer->send(
            $email,
            'A returned submission was resubmitted for your review',
            $this->organizationName($submission).' has resubmitted a returned submission for "'
                .$this->activityTitle($submission).'".'."\n\n"
                .'Sign in to the APEX signatory dashboard to review it.',
        );
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function nextSignatoryKey(array $submission, string $signatoryId): ?string
    {
        $sequence = $submission['signatory_sequence'] ?? null;

        if (! is_array($sequence)) {
            return null;
        }

        $index = array_search(DynamoKeys::signatory($signatoryId), $sequence, true);

        if ($index === false) {
            return null;
        }

        $next = $sequence[$index + 1] ?? null;

        return is_string($next) && $next !== '' ? $next : null;
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function studentEmail(array $submission): ?string
    {
        $email = data_get($submission, 'proponents.0.email_address');

        return is_string($email) && $email !== '' ? $email : null;
    }

    private function signatoryEmail(string $signatoryKey): ?string
    {
        $id = DynamoKeys::strip($signatoryKey, 'SIGNATORY#');

        return $id === null ? null : $this->signatoryEmails->forSignatory($id);
    }

    private function signatoryName(string $signatoryId): string
    {
        $record = $this->signatories->get($signatoryId);
        $name = $record['name'] ?? null;

        return is_string($name) && $name !== '' ? $name : 'the signatory';
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function organizationName(array $submission): string
    {
        $organizationId = $this->proponentOrganizationId($submission);

        if ($organizationId === null) {
            return 'an organization';
        }

        $organization = $this->organizations->get($organizationId);
        $name = $organization['name'] ?? null;

        return is_string($name) && $name !== '' ? $name : 'an organization';
    }

    /**
     * The submission carries the proponent org on GSI1PK; legacy rows written
     * before that field existed fall back to the owning event's GSI1PK.
     *
     * @param  array<string, mixed>  $submission
     */
    private function proponentOrganizationId(array $submission): ?string
    {
        $organizationKey = DynamoKeys::strip($submission['GSI1PK'] ?? null, 'ORGANIZATION#');

        if ($organizationKey === null) {
            $eventId = DynamoKeys::strip($submission['PK'] ?? null, 'EVENT#');
            $event = $eventId === null ? null : $this->events->handle($eventId);
            $organizationKey = DynamoKeys::strip($event['GSI1PK'] ?? null, 'ORGANIZATION#');
        }

        return $organizationKey;
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    private function activityTitle(array $submission): string
    {
        $title = data_get($submission, 'activity_details.title_and_nature');

        return is_string($title) && $title !== '' ? $title : 'your submission';
    }

    private function guard(string $method, callable $send): void
    {
        try {
            $send();
        } catch (Throwable $e) {
            Log::warning('Submission email dispatch failed.', [
                'method' => $method,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
