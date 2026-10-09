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
        ['method' => 'POST',   'pattern' => 'v1/students/submissions',                                    'module' => 'Submission',   'action' => 'CREATE', 'prefetch' => false],
        ['method' => 'PUT',    'pattern' => 'v1/students/events/*/submissions/*',                          'module' => 'Submission',   'action' => 'UPDATE', 'prefetch' => true],
        ['method' => 'PATCH',  'pattern' => 'v1/signatories/events/*/submissions/*/classification',        'module' => 'Submission',   'action' => 'UPDATE', 'prefetch' => true],
        ['method' => 'POST',   'pattern' => 'v1/admins/announcements',                                    'module' => 'Announcement', 'action' => 'CREATE', 'prefetch' => false],
        ['method' => 'PUT',    'pattern' => 'v1/admins/announcements/*',                                  'module' => 'Announcement', 'action' => 'UPDATE', 'prefetch' => true],
        ['method' => 'DELETE', 'pattern' => 'v1/admins/announcements/*',                                  'module' => 'Announcement', 'action' => 'DELETE', 'prefetch' => true],
        ['method' => 'POST',   'pattern' => 'v1/admins/organizations',                                    'module' => 'Organization', 'action' => 'CREATE', 'prefetch' => false],
        ['method' => 'PUT',    'pattern' => 'v1/admins/organizations/*',                                  'module' => 'Organization', 'action' => 'UPDATE', 'prefetch' => true],
        ['method' => 'POST',   'pattern' => 'v1/admins/signatories',                                      'module' => 'Signatory',    'action' => 'CREATE', 'prefetch' => false],
        ['method' => 'PUT',    'pattern' => 'v1/admins/signatories/*',                                    'module' => 'Signatory',    'action' => 'UPDATE', 'prefetch' => true],
    ];

    /**
     * Routes explicitly excluded from logging (approve, return, deny + all notification writes).
     *
     * @var list<string>
     */
    public const DENIED_PATTERNS = [
        'POST v1/signatories/events/*/submissions/*/approve',
        'POST v1/signatories/events/*/submissions/*/return',
        'POST v1/signatories/events/*/submissions/*/deny',
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
        // Strip leading slash
        $path = ltrim($path, '/');

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
}
