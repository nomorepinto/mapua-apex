<?php

namespace App\Http\Middleware;

use App\Auth\CognitoJwksUnavailable;
use App\Auth\CognitoJwtVerifier;
use App\Auth\InvalidCognitoJwt;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateCognitoJwt
{
    /**
     * Cognito groups allowed on each route role. Matching is case-insensitive.
     * `admin` may call every route. `osaar` may call admin and signatory routes only.
     *
     * @var array<string, list<string>>
     */
    private const ROUTE_GROUPS = [
        'student' => ['student', 'students', 'org_submitter', 'admin'],
        'signatory' => ['signatory', 'signatories', 'org_adviser', 'dean', 'cdm_reviewer', 'cdm', 'osaar', 'admin'],
        'admin' => ['admin', 'osaar'],
    ];

    public function __construct(private CognitoJwtVerifier $verifier) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, ?string $role = null): Response
    {
        $jwt = $request->bearerToken();

        if (! is_string($jwt) || $jwt === '') {
            $this->reject($request, $role, 'jwt_missing', 'Unauthenticated: Bearer token is missing.');
        }

        try {
            $claims = $this->verifier->verify($jwt);
        } catch (InvalidCognitoJwt $e) {
            $this->reject(
                $request,
                $role,
                'jwt_invalid',
                'Unauthenticated: Invalid Cognito token ('.$e->getMessage().').',
                error: $e->getMessage(),
            );
        } catch (CognitoJwksUnavailable $e) {
            $this->reject(
                $request,
                $role,
                'jwt_jwks_unavailable',
                'Identity provider unavailable.',
                status: 503,
                error: $e->getMessage(),
            );
        }

        $groups = $this->groups($claims['cognito:groups'] ?? null);
        $normalizedGroups = array_map(strtolower(...), $groups);
        $isAdmin = in_array('admin', $normalizedGroups, true);
        $mayImpersonateSignatory = $isAdmin || in_array('osaar', $normalizedGroups, true);

        if (is_string($role) && $role !== '' && ! $this->mayAccessRole($role, $normalizedGroups)) {
            $this->reject(
                $request,
                $role,
                'jwt_group_mismatch',
                "Unauthenticated: User is not in the required '$role' or 'admin' Cognito group.",
                extra: [
                    'groups' => $groups,
                    'token_use' => $claims['token_use'] ?? null,
                ],
            );
        }

        $request->attributes->set('cognito.is_admin', $isAdmin);
        Context::addHidden('cognito.is_admin', $isAdmin);

        $this->attachScopedId(
            $request,
            $claims,
            ['custom:organization_id', 'organization_id'],
            'X-Organization-Id',
            'ORGANIZATION#',
            'cognito.organization_id',
            'student',
            $role,
            $isAdmin,
        );

        $sub = $claims['sub'] ?? null;

        if (is_string($sub) && $sub !== '') {
            $request->attributes->set('cognito.sub', $sub);
            Context::addHidden('cognito.sub', $sub);
        }

        $this->attachScopedId(
            $request,
            $claims,
            ['custom:signatory_id', 'signatory_id'],
            'X-Signatory-Id',
            'SIGNATORY#',
            'cognito.signatory_id',
            'signatory',
            $role,
            $mayImpersonateSignatory,
        );

        return $next($request);
    }

    /**
     * @param  array<string, mixed>  $claims
     * @param  list<string>  $claimKeys
     */
    private function attachScopedId(
        Request $request,
        array $claims,
        array $claimKeys,
        string $header,
        string $prefix,
        string $attribute,
        string $requiredForRole,
        ?string $role,
        bool $isAdmin,
    ): void {
        $value = $this->firstNonEmptyClaim($claims, $claimKeys);

        if ($value !== null) {
            $value = Str::chopStart($value, $prefix);
            $request->attributes->set($attribute, $value);
            Context::addHidden($attribute, $value);

            return;
        }

        if ($isAdmin) {
            $fromHeader = $request->header($header);

            if (is_string($fromHeader) && $fromHeader !== '') {
                $fromHeader = Str::chopStart($fromHeader, $prefix);
                $request->attributes->set($attribute, $fromHeader);
                Context::addHidden($attribute, $fromHeader);
            }

            return;
        }

        if ($role === $requiredForRole) {
            $this->reject(
                $request,
                $role,
                'jwt_claim_missing',
                "Unauthenticated: Missing {$claimKeys[0]} in Cognito token.",
                extra: [
                    'missing_claim' => $claimKeys[0],
                    'token_use' => $claims['token_use'] ?? null,
                    'has_organization_id_claim' => $this->firstNonEmptyClaim($claims, ['custom:organization_id', 'organization_id']) !== null,
                    'has_signatory_id_claim' => $this->firstNonEmptyClaim($claims, ['custom:signatory_id', 'signatory_id']) !== null,
                ],
            );
        }
    }

    /**
     * @param  array<string, mixed>  $claims
     * @param  list<string>  $claimKeys
     */
    private function firstNonEmptyClaim(array $claims, array $claimKeys): ?string
    {
        foreach ($claimKeys as $key) {
            $value = $claims[$key] ?? null;

            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function groups(mixed $groups): array
    {
        if (is_string($groups) && $groups !== '') {
            return [$groups];
        }

        if (! is_array($groups)) {
            return [];
        }

        return array_values(array_filter($groups, fn (mixed $group): bool => is_string($group) && $group !== ''));
    }

    /**
     * @param  list<string>  $normalizedGroups
     */
    private function mayAccessRole(string $role, array $normalizedGroups): bool
    {
        $allowed = self::ROUTE_GROUPS[strtolower($role)] ?? [strtolower($role)];

        foreach ($allowed as $group) {
            if (in_array($group, $normalizedGroups, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function reject(
        Request $request,
        ?string $role,
        string $reason,
        string $message,
        int $status = 401,
        ?string $error = null,
        array $extra = [],
    ): never {
        $poolId = (string) config('aws.cognito.user_pool_id');
        $clientId = (string) config('aws.cognito.client_id');

        Log::warning('Cognito JWT authentication failed.', [
            'reason' => $reason,
            'role' => $role,
            'method' => $request->method(),
            'path' => $request->path(),
            'has_bearer' => is_string($request->bearerToken()) && $request->bearerToken() !== '',
            'cognito_pool_configured' => $poolId !== '',
            'cognito_client_configured' => $clientId !== '',
            'cognito_region' => config('aws.cognito.region'),
            'error' => $error,
            ...$extra,
        ]);

        abort($status, $message);
    }
}
