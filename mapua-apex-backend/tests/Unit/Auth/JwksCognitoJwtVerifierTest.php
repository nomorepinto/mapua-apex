<?php

namespace Tests\Unit\Auth;

use App\Auth\CognitoJwksUnavailable;
use App\Auth\InvalidCognitoJwt;
use App\Auth\JwksCognitoJwtVerifier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use Tests\Support\CognitoJwtFactory;
use Tests\TestCase;

class JwksCognitoJwtVerifierTest extends TestCase
{
    public function test_verifies_a_signed_id_token_against_faked_jwks(): void
    {
        Http::preventStrayRequests();

        $issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test';
        $signed = CognitoJwtFactory::signedToken([
            'iss' => $issuer,
            'aud' => 'test-client',
            'token_use' => 'id',
            'custom:organization_id' => 'a1b2',
        ]);

        Http::fake([
            $issuer.'/.well-known/jwks.json' => Http::response($signed['jwks']),
        ]);

        $claims = (new JwksCognitoJwtVerifier)->verify($signed['jwt']);

        $this->assertSame('a1b2', $claims['custom:organization_id']);
        $this->assertSame('id', $claims['token_use']);
        Http::assertSentCount(1);
    }

    public function test_reuses_cached_jwks_for_a_second_verification(): void
    {
        Http::preventStrayRequests();

        $issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test';
        $signed = CognitoJwtFactory::signedToken([
            'iss' => $issuer,
            'aud' => 'test-client',
            'token_use' => 'id',
        ]);

        Http::fake([
            $issuer.'/.well-known/jwks.json' => Http::response($signed['jwks']),
        ]);

        $verifier = new JwksCognitoJwtVerifier;
        $verifier->verify($signed['jwt']);
        $verifier->verify($signed['jwt']);

        Http::assertSentCount(1);
        $this->assertNotEmpty(Cache::get('cognito.jwks.us-east-1_test'));
    }

    public function test_verifies_an_access_token_client_id(): void
    {
        Http::preventStrayRequests();

        $issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test';
        $signed = CognitoJwtFactory::signedToken([
            'iss' => $issuer,
            'client_id' => 'test-client',
            'token_use' => 'access',
        ]);

        Http::fake([
            $issuer.'/.well-known/jwks.json' => Http::response($signed['jwks']),
        ]);

        $claims = (new JwksCognitoJwtVerifier)->verify($signed['jwt']);

        $this->assertSame('access', $claims['token_use']);
    }

    public function test_rejects_a_token_with_the_wrong_audience(): void
    {
        Http::preventStrayRequests();

        $issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test';
        $signed = CognitoJwtFactory::signedToken([
            'iss' => $issuer,
            'aud' => 'other-client',
            'token_use' => 'id',
        ]);

        Http::fake([
            $issuer.'/.well-known/jwks.json' => Http::response($signed['jwks']),
        ]);

        $this->expectException(InvalidCognitoJwt::class);

        (new JwksCognitoJwtVerifier)->verify($signed['jwt']);
    }

    public function test_rejects_a_token_with_the_wrong_issuer(): void
    {
        Http::preventStrayRequests();

        $issuer = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test';
        $signed = CognitoJwtFactory::signedToken([
            'iss' => 'https://cognito-idp.us-east-1.amazonaws.com/other-pool',
            'aud' => 'test-client',
            'token_use' => 'id',
        ]);

        Http::fake([
            $issuer.'/.well-known/jwks.json' => Http::response($signed['jwks']),
        ]);

        $this->expectException(InvalidCognitoJwt::class);

        (new JwksCognitoJwtVerifier)->verify($signed['jwt']);
    }

    public function test_throws_when_jwks_cannot_be_fetched(): void
    {
        Sleep::fake();
        Http::preventStrayRequests();

        Http::fake([
            'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test/.well-known/jwks.json' => Http::failedConnection(),
        ]);

        $this->expectException(CognitoJwksUnavailable::class);

        (new JwksCognitoJwtVerifier)->verify('not-a-jwt');
    }
}
