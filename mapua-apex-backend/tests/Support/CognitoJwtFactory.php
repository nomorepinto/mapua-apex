<?php

namespace Tests\Support;

use Firebase\JWT\JWT;
use RuntimeException;

final class CognitoJwtFactory
{
    /**
     * @param  array<string, mixed>  $claims
     * @return array{jwks: array<string, mixed>, jwt: string}
     */
    public static function signedToken(array $claims, string $kid = 'test-kid'): array
    {
        $fixturePath = dirname(__DIR__).'/Fixtures/cognito';
        $privatePem = file_get_contents($fixturePath.'/private.pem');
        $jwksJson = file_get_contents($fixturePath.'/jwks.json');

        if (! is_string($privatePem) || $privatePem === '' || ! is_string($jwksJson) || $jwksJson === '') {
            throw new RuntimeException('Cognito JWT test fixtures are missing.');
        }

        $jwks = json_decode($jwksJson, true);

        if (! is_array($jwks)) {
            throw new RuntimeException('Cognito JWKS test fixture is invalid.');
        }

        $now = time();
        $payload = array_merge([
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + 3600,
            'token_use' => 'id',
        ], $claims);

        return [
            'jwks' => $jwks,
            'jwt' => JWT::encode($payload, $privatePem, 'RS256', $kid),
        ];
    }
}
