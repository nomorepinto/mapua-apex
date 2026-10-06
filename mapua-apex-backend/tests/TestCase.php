<?php

namespace Tests;

use App\Auth\CognitoJwtVerifier;
use App\Aws\DynamoDb\DynamoDbItems;
use App\Support\Email\CognitoSignatoryEmails;
use App\Support\Email\EmailSender;
use Aws\DynamoDb\DynamoDbClient;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Mockery\MockInterface;
use Tests\Fakes\FakeCognitoJwtVerifier;
use Tests\Fakes\FakeCognitoSignatoryEmails;
use Tests\Fakes\FakeEmailSender;
use Tests\Fakes\InMemoryDynamoDb;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Keep every test offline: no SES sends, no Cognito user-pool lookups.
        $this->fakeEmailSender();
        $this->fakeSignatoryEmails();
    }

    protected function fakeEmailSender(): FakeEmailSender
    {
        $sender = new FakeEmailSender;
        $this->app->instance(EmailSender::class, $sender);

        return $sender;
    }

    /**
     * @param  array<string, string>  $emails  signatory uuid => email
     */
    protected function fakeSignatoryEmails(array $emails = [
        'adv001' => 'adv001@mapua.edu.ph',
        'adv002' => 'adv002@mapua.edu.ph',
        'dean001' => 'dean001@mapua.edu.ph',
        'osaar001' => 'osaar001@mapua.edu.ph',
        'cdm001' => 'cdm001@mapua.edu.ph',
    ]): FakeCognitoSignatoryEmails
    {
        $lookup = new FakeCognitoSignatoryEmails($emails);
        $this->app->instance(CognitoSignatoryEmails::class, $lookup);

        return $lookup;
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    protected function fakeCognitoJwt(array $claims = [], bool $shouldFail = false, bool $jwksUnavailable = false): FakeCognitoJwtVerifier
    {
        $verifier = new FakeCognitoJwtVerifier($claims, $shouldFail, $jwksUnavailable);

        $this->app->instance(CognitoJwtVerifier::class, $verifier);

        return $verifier;
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    protected function withStudentAuth(array $claims = [], string $jwt = 'fake-jwt'): static
    {
        $this->fakeCognitoJwt($claims);

        return $this->withToken($jwt);
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    protected function withSignatoryAuth(array $claims = [], string $jwt = 'fake-jwt'): static
    {
        $this->fakeCognitoJwt(array_merge([
            'cognito:groups' => ['signatory'],
            'custom:signatory_id' => 'adv001',
        ], $claims));

        return $this->withToken($jwt);
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    protected function withAdminAuth(array $claims = [], string $jwt = 'fake-jwt'): static
    {
        $this->fakeCognitoJwt(array_merge([
            'cognito:groups' => ['admin'],
            'custom:organization_id' => '',
        ], $claims));

        return $this->withToken($jwt);
    }

    public function swapDynamoDbClient(DynamoDbClient|MockInterface $client): void
    {
        $this->app->instance(DynamoDbClient::class, $client);
        $this->app->forgetInstance(DynamoDbItems::class);
    }

    protected function fakeDynamoDb(): InMemoryDynamoDb
    {
        return InMemoryDynamoDb::bind($this);
    }
}
