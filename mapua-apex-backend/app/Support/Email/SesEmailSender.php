<?php

namespace App\Support\Email;

use Aws\Exception\AwsException;
use Aws\Ses\SesClient;
use Illuminate\Support\Facades\Log;
use Throwable;

final class SesEmailSender implements EmailSender
{
    public function __construct(private SesClient $ses) {}

    public function send(string $to, string $subject, string $body): void
    {
        $source = (string) config('mail.from.address', '');

        if ($source === '' || $source === 'hello@example.com') {
            Log::warning('SES email skipped: MAIL_FROM_ADDRESS is not configured.', ['to' => $to, 'subject' => $subject]);

            return;
        }

        try {
            $this->ses->sendEmail([
                'Source' => $source,
                'Destination' => ['ToAddresses' => [$to]],
                'Message' => [
                    'Subject' => ['Data' => $subject, 'Charset' => 'UTF-8'],
                    'Body' => ['Text' => ['Data' => $body, 'Charset' => 'UTF-8']],
                ],
            ]);
        } catch (AwsException $e) {
            Log::warning('SES email send failed.', [
                'to' => $to,
                'subject' => $subject,
                'error' => $e->getMessage(),
            ]);
        } catch (Throwable $e) {
            Log::warning('SES email send failed unexpectedly.', [
                'to' => $to,
                'subject' => $subject,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
