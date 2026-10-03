<?php

namespace App\Auth;

interface CognitoJwtVerifier
{
    /**
     * Verify a Cognito JWT and return its claims.
     *
     * @return array<string, mixed>
     *
     * @throws InvalidCognitoJwt
     * @throws CognitoJwksUnavailable
     */
    public function verify(string $jwt): array;
}
