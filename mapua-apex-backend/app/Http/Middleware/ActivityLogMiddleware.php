<?php

namespace App\Http\Middleware;

use App\Logging\ActivityLoggingConfig;
use App\Logging\ActivityLogWriter;
use App\Logging\SessionLogWriter;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ActivityLogMiddleware
{
    public function __construct(
        private readonly ActivityLogWriter $activityLogWriter
    ) {}

    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Only log successful mutation requests
        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 400) {
            return $response;
        }

        try {
            $method = strtoupper($request->method());
            $path = $request->path();

            if (! ActivityLoggingConfig::shouldLog($method, $path)) {
                return $response;
            }

            $user = $request->attributes->get('cognito_user');
            if (! $user) {
                return $response;
            }

            $details = ActivityLoggingConfig::extractDetails($request, $response);
            if (! $details) {
                return $response;
            }

            $sessionId = $request->header('X-Session-ID') ?? ($user['sub'] ?? 'unknown');

            $this->activityLogWriter->logMutation(
                sessionId: $sessionId,
                userId: $user['sub'] ?? 'unknown',
                userName: $user['name'] ?? $user['email'] ?? 'Unknown User',
                userEmail: $user['email'] ?? 'unknown@mapua.edu.ph',
                userRole: $user['role'] ?? 'unknown',
                ipAddress: SessionLogWriter::resolveClientIp($request),
                actionType: $details['actionType'],
                module: $details['module'],
                entityId: $details['entityId'] ?? 'N/A',
                entityName: $details['entityName'] ?? 'N/A',
                description: $details['description'] ?? '',
                before: $details['before'] ?? null,
                after: $details['after'] ?? null,
                organizationName: $details['organizationName'] ?? null,
            );
        } catch (\Throwable $e) {
            Log::error('ActivityLogMiddleware failed: '.$e->getMessage(), [
                'exception' => $e,
                'path' => $request->path(),
            ]);
        }

        return $response;
    }
}
