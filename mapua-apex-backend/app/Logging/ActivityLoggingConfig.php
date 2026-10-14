<?php

namespace App\Logging;

/**
 * Single source of truth for which API mutations are logged and which are excluded.
 * Patterns use fnmatch-style wildcards. Methods are uppercase.
 */
final class ActivityLoggingConfig
{
    /**
     * Routes to log. Order matters — first match wins.
     *
     * @var list<array{method: string, pattern: string, module: string, action: string, prefetch: bool}>
     */
    public const ALLOWED_ACTIONS = [
        ['method' => 'POST',   'pattern' => 'v1/students/submissions',                                    'module' => 'Submission',   'action' => 'SUBMISSION_CREATE', 'prefetch' => false],
        ['method' => 'PUT',    'pattern' => 'v1/students/events/*/submissions/*',                          'module' => 'Submission',   'action' => 'SUBMISSION_UPDATE', 'prefetch' => true],
        ['method' => 'POST',   'pattern' => 'v1/signatories/events/*/submissions/*/approve',              'module' => 'Submission',   'action' => 'SUBMISSION_APPROVE', 'prefetch' => false],
        ['method' => 'POST',   'pattern' => 'v1/signatories/events/*/submissions/*/return',               'module' => 'Submission',   'action' => 'SUBMISSION_RETURN',  'prefetch' => false],
        ['method' => 'POST',   'pattern' => 'v1/signatories/events/*/submissions/*/deny',                 'module' => 'Submission',   'action' => 'SUBMISSION_DENY',    'prefetch' => false],
        ['method' => 'PATCH',  'pattern' => 'v1/signatories/events/*/submissions/*/classification',        'module' => 'Submission',   'action' => 'SUBMISSION_UPDATE', 'prefetch' => true],
        ['method' => 'POST',   'pattern' => 'v1/admins/announcements',                                    'module' => 'Announcement', 'action' => 'CREATE', 'prefetch' => false],
        ['method' => 'PUT',    'pattern' => 'v1/admins/announcements/*',                                  'module' => 'Announcement', 'action' => 'UPDATE', 'prefetch' => true],
        ['method' => 'DELETE', 'pattern' => 'v1/admins/announcements/*',                                  'module' => 'Announcement', 'action' => 'DELETE', 'prefetch' => true],
        ['method' => 'POST',   'pattern' => 'v1/admins/organizations',                                    'module' => 'Organization', 'action' => 'CREATE', 'prefetch' => false],
        ['method' => 'PUT',    'pattern' => 'v1/admins/organizations/*',                                  'module' => 'Organization', 'action' => 'UPDATE', 'prefetch' => true],
        ['method' => 'POST',   'pattern' => 'v1/admins/signatories',                                      'module' => 'Signatory',    'action' => 'CREATE', 'prefetch' => false],
        ['method' => 'PUT',    'pattern' => 'v1/admins/signatories/*',                                    'module' => 'Signatory',    'action' => 'UPDATE', 'prefetch' => true],
    ];

    /**
     * Routes explicitly excluded from logging (notification timeline sub-writes).
     *
     * @var list<string>
     */
    public const DENIED_PATTERNS = [
        'POST v1/students/events/*/submissions/*/notifications',
        'PUT  v1/students/events/*/submissions/*/notifications/*',
        'POST v1/signatories/events/*/submissions/*/notifications',
        'PUT  v1/signatories/events/*/submissions/*/notifications/*',
    ];

    /**
     * Fields that must NEVER appear in a before/after diff — even nested.
     *
     * @var list<string>
     */
    public const NEVER_LOG_FIELDS = [
        'password', 'token', 'secret', 'key', 'authorization',
        'cookie', 'access_token', 'id_token', 'refresh_token',
        'client_secret', 'api_key',
    ];

    /**
     * Find the matching ALLOWED_ACTIONS rule for this method + path, or null if not logged.
     *
     * @return array{method: string, pattern: string, module: string, action: string, prefetch: bool}|null
     */
    public static function match(string $method, string $path): ?array
    {
        $method = strtoupper($method);
        $path = ltrim($path, '/');
        if (str_starts_with($path, 'api/')) {
            $path = substr($path, 4);
        }

        foreach (self::ALLOWED_ACTIONS as $rule) {
            if ($rule['method'] === $method && fnmatch($rule['pattern'], $path)) {
                return $rule;
            }
        }

        return null;
    }

    /**
     * Strip NEVER_LOG_FIELDS keys recursively from an array.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function stripSecrets(array $data): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            if (in_array(strtolower((string) $key), self::NEVER_LOG_FIELDS, true)) {
                continue;
            }

            $result[$key] = is_array($value) ? self::stripSecrets($value) : $value;
        }

        return $result;
    }

    /**
     * Compute a before/after diff: only fields that changed, are new, or were removed.
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return array{before: array<string, mixed>, after: array<string, mixed>}
     */
    public static function diff(array $before, array $after): array
    {
        $internalKeys = ['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK', 'GSI4PK', 'GSI4SK', 'TTL'];

        $before = self::stripSecrets(array_diff_key($before, array_flip($internalKeys)));
        $after  = self::stripSecrets(array_diff_key($after,  array_flip($internalKeys)));

        $allKeys = array_unique(array_merge(array_keys($before), array_keys($after)));
        $diffBefore = [];
        $diffAfter  = [];

        foreach ($allKeys as $key) {
            $bVal = $before[$key] ?? null;
            $aVal = $after[$key]  ?? null;

            if (json_encode($bVal) !== json_encode($aVal)) {
                $diffBefore[$key] = $bVal;
                $diffAfter[$key]  = $aVal;
            }
        }

        return ['before' => $diffBefore, 'after' => $diffAfter];
    }

    public static function shouldLog(string $method, string $path): bool
    {
        $method = strtoupper($method);
        $path = ltrim($path, '/');
        if (str_starts_with($path, 'api/')) {
            $path = substr($path, 4);
        }

        foreach (self::DENIED_PATTERNS as $denied) {
            $parts = preg_split('/\s+/', trim($denied), 2);
            if (count($parts) === 2) {
                [$deniedMethod, $deniedPattern] = $parts;
                if ($method === strtoupper($deniedMethod) && fnmatch($deniedPattern, $path)) {
                    return false;
                }
            }
        }

        return self::match($method, $path) !== null;
    }

    /**
     * Extract activity details from request and response for logging.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  mixed  $response
     * @return array{actionType: string, module: string, entityId: string, entityName: string, description: string, before: array|null, after: array|null}|null
     */
    public static function extractDetails($request, $response): ?array
    {
        $rule = self::match($request->method(), $request->path());
        if (! $rule) {
            return null;
        }

        $actionType = $rule['action'];
        $module = $rule['module'];

        $resData = [];
        if (method_exists($response, 'getContent')) {
            $content = json_decode($response->getContent(), true);
            if (is_array($content)) {
                $resData = $content['data'] ?? $content;
            }
        }

        $reqBody = $request->isJson() ? $request->json()->all() : $request->all();

        $entityId = 'N/A';
        if (! empty($resData['submission_id'])) {
            $entityId = (string) $resData['submission_id'];
        } elseif (! empty($resData['announcement_id'])) {
            $entityId = (string) $resData['announcement_id'];
        } elseif (! empty($resData['organization_id'])) {
            $entityId = (string) $resData['organization_id'];
        } elseif (! empty($resData['signatory_id'])) {
            $entityId = (string) $resData['signatory_id'];
        } elseif ($request->route('submission')) {
            $entityId = (string) $request->route('submission');
        } elseif ($request->route('announcement')) {
            $entityId = (string) $request->route('announcement');
        } elseif ($request->route('organization')) {
            $entityId = (string) $request->route('organization');
        } elseif ($request->route('signatory')) {
            $entityId = (string) $request->route('signatory');
        }

        $entityName = 'N/A';
        if (! empty($reqBody['title'])) {
            $entityName = (string) $reqBody['title'];
        } elseif (! empty($reqBody['name'])) {
            $entityName = (string) $reqBody['name'];
        } elseif (! empty($resData['activity_details']['title_and_nature'])) {
            $entityName = (string) $resData['activity_details']['title_and_nature'];
        } elseif (! empty($resData['title'])) {
            $entityName = (string) $resData['title'];
        } elseif (! empty($resData['name'])) {
            $entityName = (string) $resData['name'];
        }

        $comment = $reqBody['comment'] ?? $reqBody['remarks'] ?? null;

        $description = match ($actionType) {
            'SUBMISSION_APPROVE' => "Approved submission {$entityId}".($comment ? " — Comment: {$comment}" : ''),
            'SUBMISSION_RETURN'  => "Returned submission {$entityId} for revision".($comment ? " — Comment: {$comment}" : ''),
            'SUBMISSION_DENY'    => "Denied submission {$entityId}".($comment ? " — Comment: {$comment}" : ''),
            'SUBMISSION_CREATE'  => "Submitted new event proposal".($entityName !== 'N/A' ? " '{$entityName}'" : '')." ({$entityId})",
            'SUBMISSION_UPDATE'  => "Updated submission".($entityName !== 'N/A' ? " '{$entityName}'" : '')." ({$entityId})",
            default => $entityName !== 'N/A'
                ? "{$actionType} {$module} '{$entityName}' ({$entityId})"
                : "{$actionType} {$module} {$entityId}",
        };

        $organizationName = $resData['organization_name'] ?? $resData['organization']['name'] ?? $reqBody['organization_name'] ?? 'N/A';

        $before = null;
        $after = is_array($reqBody) ? self::stripSecrets($reqBody) : null;

        return [
            'actionType' => $actionType,
            'module' => $module,
            'entityId' => $entityId,
            'entityName' => $entityName,
            'organizationName' => $organizationName,
            'description' => $description,
            'before' => $before,
            'after' => $after,
        ];
    }
}
