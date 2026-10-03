<?php

namespace App\Auth;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use JsonException;
use Throwable;

final class JwksCognitoJwtVerifier implements CognitoJwtVerifier
{
    /**
     * @return array<string, mixed>
     */
    public function verify(string $jwt): array
    {
        $region = (string) config('aws.cognito.region');
        $poolId = (string) config('aws.cognito.user_pool_id');
        $clientId = (string) config('aws.cognito.client_id');

        if ($poolId === '' || $clientId === '') {
            throw new InvalidCognitoJwt('Identity provider is not configured.');
        }

        $claims = $this->decode($jwt, $this->jwks($region, $poolId));

        $issuer = sprintf('https://cognito-idp.%s.amazonaws.com/%s', $region, $poolId);

        if (($claims['iss'] ?? null) !== $issuer) {
            throw new InvalidCognitoJwt('Invalid token issuer.');
        }

        $tokenUse = $claims['token_use'] ?? null;

        if ($tokenUse === 'id' && ($claims['aud'] ?? null) !== $clientId) {
            throw new InvalidCognitoJwt('Invalid token audience.');
        }

        if ($tokenUse === 'access' && ($claims['client_id'] ?? null) !== $clientId) {
            throw new InvalidCognitoJwt('Invalid token client.');
        }

        if (! in_array($tokenUse, ['id', 'access'], true)) {
            throw new InvalidCognitoJwt('Invalid token use.');
        }

        return $claims;
    }

    /**
     * @return array<string, mixed>
     */
    private function jwks(string $region, string $poolId): array
    {
        $url = sprintf(
            'https://cognito-idp.%s.amazonaws.com/%s/.well-known/jwks.json',
            $region,
            $poolId,
        );

        try {
            $jwks = Cache::remember('cognito.jwks.'.$poolId, 3600, function () use ($url): array {
                $http = Http::connectTimeout(3)->timeout(5);

                if (app()->environment('local', 'testing')) {
                    $http = $http->withoutVerifying();
                }

                $payload = $http
                    ->retry([100, 500], 0, fn (Throwable $exception): bool => $exception instanceof ConnectionException)
                    ->get($url)
                    ->throw()
                    ->json();

                if (! is_array($payload)) {
                    throw new CognitoJwksUnavailable('Invalid JWKS payload.');
                }

                return $payload;
            });
        } catch (CognitoJwksUnavailable $exception) {
            throw $exception;
        } catch (ConnectionException|RequestException $exception) {
            throw new CognitoJwksUnavailable('Identity provider unavailable.', previous: $exception);
        }

        if (! is_array($jwks)) {
            throw new CognitoJwksUnavailable('Invalid JWKS payload.');
        }

        return $jwks;
    }

    /**
     * @param  array<string, mixed>  $jwks
     * @return array<string, mixed>
     */
    private function decode(string $jwt, array $jwks): array
    {
        $previousLeeway = JWT::$leeway;
        JWT::$leeway = 60;

        try {
            $decoded = JWT::decode($jwt, JWK::parseKeySet($jwks));
            $claims = json_decode(json_encode($decoded, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException|Throwable $exception) {
            throw new InvalidCognitoJwt('Invalid token.', previous: $exception);
        } finally {
            JWT::$leeway = $previousLeeway;
        }

        if (! is_array($claims)) {
            throw new InvalidCognitoJwt('Invalid token.');
        }

        return $claims;
    }
}
