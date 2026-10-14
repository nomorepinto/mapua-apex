<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shared-secret guard for server-to-server calls from the arcus companion apps
 * (arcus-attendance-system, arcus-evaluation-system).
 *
 * These calls originate from the arcus Next.js server, not a browser, and are
 * issued under a different Cognito app client than the SPA, so the user's JWT is
 * not verifiable here. Instead the arcus server proves itself with a shared
 * secret and forwards the caller's organization scope — derived server-side from
 * the verified user token — on X-Arcus-Organization-Id. Omit that header for
 * admin callers to act across all organizations.
 */
class AuthenticateArcusService
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.arcus.service_token', '');

        if ($expected === '') {
            Log::warning('Arcus service call rejected: ARCUS_SERVICE_TOKEN is not configured.');

            abort(503, 'Arcus service integration is not configured.');
        }

        $provided = (string) $request->header('X-Arcus-Service-Token', '');

        if ($provided === '' || ! hash_equals($expected, $provided)) {
            Log::warning('Arcus service call rejected: bad or missing service token.', [
                'path' => $request->path(),
                'method' => $request->method(),
            ]);

            abort(401, 'Unauthenticated: invalid arcus service token.');
        }

        $organizationId = $request->header('X-Arcus-Organization-Id');

        if (is_string($organizationId) && $organizationId !== '') {
            $request->attributes->set('arcus.organization_id', Str::chopStart($organizationId, 'ORGANIZATION#'));
        }

        return $next($request);
    }
}
