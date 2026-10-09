<?php

namespace Tests\Unit\Support\Email;

use App\Support\Email\SesEmailSender;
use Aws\Exception\AwsException;
use Aws\Ses\SesClient;
use Mockery;
use Tests\TestCase;

class SesEmailSenderTest extends TestCase
{
    public function test_sends_through_the_ses_client_with_the_configured_source(): void
    {
        config(['mail.from.address' => 'noreply@mapua-apex.test']);

        $client = Mockery::mock(SesClient::class);
        $client->shouldReceive('sendEmail')
            ->once()
            ->with(Mockery::on(function (array $params): bool {
                return $params['Source'] === 'noreply@mapua-apex.test'
                    && $params['Destination']['ToAddresses'] === ['student@mapua.edu.ph']
                    && $params['Message']['Subject']['Data'] === 'Subject'
                    && $params['Message']['Body']['Text']['Data'] === 'Body';
            }))
            ->andReturn([]);

        (new SesEmailSender($client))->send('student@mapua.edu.ph', 'Subject', 'Body');
    }

    public function test_skips_sending_when_the_from_address_is_not_configured(): void
    {
        config(['mail.from.address' => 'hello@example.com']);

        $client = Mockery::mock(SesClient::class);
        $client->shouldNotReceive('sendEmail');

        (new SesEmailSender($client))->send('student@mapua.edu.ph', 'Subject', 'Body');
    }

    public function test_swallows_aws_failures(): void
    {
        config(['mail.from.address' => 'noreply@mapua-apex.test']);

        $client = Mockery::mock(SesClient::class);
        $client->shouldReceive('sendEmail')
            ->once()
            ->andThrow(Mockery::mock(AwsException::class, ['getMessage' => 'throttled']));

        (new SesEmailSender($client))->send('student@mapua.edu.ph', 'Subject', 'Body');

        $this->assertTrue(true);
    }
}
