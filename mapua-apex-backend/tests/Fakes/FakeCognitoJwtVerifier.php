<?php

namespace Tests\Fakes;

use App\Auth\CognitoJwksUnavailable;
use App\Auth\CognitoJwtVerifier;
use App\Auth\InvalidCognitoJwt;

final class FakeCognitoJwtVerifier implements CognitoJwtVerifier
{
    /**
     * @param  array<string, mixed>  $claims
     */
    public function __construct(
        array $claims = [],
        private bool $shouldFail = false,
        private bool $jwksUnavailable = false,
    ) {
        $this->claims = array_merge([
            'sub' => 'user-1',
            'custom:organization_id' => 'a1b2',
            'token_use' => 'id',
            'cognito:groups' => ['student'],
        ], $claims);
    }

    /**
     * @var array<string, mixed>
     */
    private array $claims;

    /**
     * @return array<string, mixed>
     */
    public function verify(string $jwt): array
    {
        if ($this->jwksUnavailable) {
            throw new CognitoJwksUnavailable('Identity provider unavailable.');
        }

        if ($this->shouldFail || $jwt === '' || $jwt === 'invalid-jwt') {
            throw new InvalidCognitoJwt('Invalid token.');
        }

        return $this->claims;
    }
}
