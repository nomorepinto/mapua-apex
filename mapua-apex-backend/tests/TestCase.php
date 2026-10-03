<?php

namespace Tests;

use App\Auth\CognitoJwtVerifier;
use App\Aws\DynamoDb\DynamoDbItems;
use Aws\DynamoDb\DynamoDbClient;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Mockery\MockInterface;
use Tests\Fakes\FakeCognitoJwtVerifier;
use Tests\Fakes\InMemoryDynamoDb;

abstract class TestCase extends BaseTestCase
{
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
