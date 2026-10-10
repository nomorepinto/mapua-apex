<?php

namespace App\Logging;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Manages session lifecycle in the single-table MAPUA_APEX session log.
 *
 * Item key structure (plan §2.1):
 *   PK  = SESSION#{session_id}   SK  = METADATA
 *   GSI1PK = LOG#SESSION#{YYYY-MM}  GSI1SK = {login_time}   ← monthly query bucket
 *   GSI2PK = USER#{sub}             GSI2SK = {login_time}   ← per-user history
 *
 * Session ID derivation: sha256(sub:auth_time) — deterministic from the JWT,
 * stable across tab refreshes, shared across tabs, new on real re-authentication.
 *
 * Chain suffix (#2, #3…) is appended when the base session has already ended,
 * so a returning user gets a fresh session without reopening the closed one.
 */
final class SessionLogWriter
{
    /** Sessions with no heartbeat beyond this threshold are considered timed out. */
    private const STALE_MINUTES = 15;

    /** Maximum pages_visited entries per session to stay under the 400 KB DynamoDB item limit. */
    private const MAX_PAGES = 200;

    /** Fixed SK for every session item (single-item-per-session pattern). */
    private const SK = 'METADATA';

    public function __construct(
        private readonly LogTableItems $db,
        private readonly ActivityLogWriter $activities,
    ) {}

    // ─────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────

    public static function resolveClientIp(Request $request): string
    {
        $forwarded = $request->header('X-Forwarded-For');

        if (is_string($forwarded) && trim($forwarded) !== '') {
            $ip = trim(explode(',', $forwarded)[0]);
        } else {
            $ip = $request->header('X-Real-IP') ?? $request->ip() ?? '127.0.0.1';
        }

        if ($ip === '::1') {
            return '127.0.0.1';
        }

        return $ip;
    }

    /**
     * Helper to verify that a session ID belongs to a given user (base hash or base#N suffix).
     * The base hash is sha256(sub:auth_time), so we cannot invert it — ownership is
     * asserted via the stored `sub` field in the item. This static helper allows a
     * lightweight check before the DB read when the session ID format is obviously wrong.
     */
    public static function verifySessionOwnership(string $sessionId, string $sub): bool
    {
        // Currently we rely on the DB item's `sub` field for authoritative ownership
        // validation in heartbeat/end; this is a pre-check stub.
        return $sessionId !== '' && $sub !== '';
    }

    /**
     * Start or resume a session for the authenticated user.
     *
     * @return array{sessionId: string, login_time: string, status: string, isNewSession: bool}
     */
    public function startSession(
        string $sub,
        int $authTime,
        string $userName,
        string $userEmail,
        string $userRole,
        string $ipAddress,
        string $userAgent,
        array $pagesVisited = []
    ): array {
        $base = $this->deriveBase($sub, $authTime);
        $res = $this->resolveChain(
            base: $base,
            sub: $sub,
            userName: $userName,
            userEmail: $userEmail,
            userRole: $userRole,
            ipAddress: $ipAddress,
            userAgent: $userAgent,
            newPages: $pagesVisited,
        );

        return [
            'sessionId' => $res['sessionId'],
            'login_time' => $this->now(),
            'status' => $res['status'],
            'isNewSession' => $res['isNewSession'] ?? true,
        ];
    }

    /**
     * Extend an active session's last_heartbeat + pages_visited.
     * Returns true on success, false if the session has ended/timed-out or not found.
     *
     * @param  array<array{path: string, timestamp: string}>  $newPages
     */
    public function heartbeat(string $sessionId, string $sub, array $newPages = []): string
    {
        $table = $this->db->sessionTable();
        $pk = DynamoKeys::session($sessionId);
        $item = $this->db->get($table, $pk, self::SK);

        if ($item === null) {
            return 'not_found';
        }

        if (($item['sub'] ?? '') !== $sub) {
            return 'forbidden';
        }

        // Stale-active check
        if (($item['status'] ?? '') === 'active' && $this->isStale($item)) {
            $this->closeSession($sessionId, $item, 'timed_out');

            return 'expired';
        }

        if (($item['status'] ?? '') !== 'active') {
            return 'expired';
        }

        $pagesVisited = is_array($item['pages_visited'] ?? null) ? $item['pages_visited'] : [];
        $truncated = (bool) ($item['pages_visited_truncated'] ?? false);
        [$pagesVisited, $truncated] = $this->appendPages($pagesVisited, $newPages, $truncated);

        $now = $this->now();
        $loginTime = (string) ($item['login_time'] ?? $now);
        $set = [
            'last_heartbeat' => $now,
            'duration_seconds' => max(0, strtotime($now) - strtotime($loginTime)),
            'GSI3SK' => $now,
        ];

        if ($newPages !== []) {
            $set['pages_visited'] = $pagesVisited;
            $set['pages_visited_truncated'] = $truncated;
            $set['events_count'] = ($item['events_count'] ?? 0) + count($newPages);
        }

        try {
            $this->db->patch($table, $pk, self::SK, $set);
        } catch (\Throwable $e) {
            Log::warning('SessionLogWriter: heartbeat patch failed', [
                'sessionId' => $sessionId,
                'error' => $e->getMessage(),
            ]);
        }

        return 'ok';
    }

    /**
     * End a session explicitly (logout or tab_closed).
     *
     * @return array{0: string}
     */
    public function end(string $sessionId, string $sub, string $reason = 'logout'): array
    {
        $table = $this->db->sessionTable();
        $pk = DynamoKeys::session($sessionId);
        $item = $this->db->get($table, $pk, self::SK);

        if ($item === null) {
            return ['not_found'];
        }

        if (($item['sub'] ?? '') !== $sub) {
            return ['forbidden'];
        }

        if (($item['status'] ?? '') === 'completed') {
            return ['ok']; // idempotent
        }

        $this->closeSession($sessionId, $item, $reason);

        return ['ok'];
    }

    /**
     * Terminate a session for any reason (called by endSession from SessionController).
     *
     * @return array{sessionId: string, status: string, logout_time: string, endReason: string}|null
     */
    public function endSession(string $sessionId, string $endReason = 'logout'): ?array
    {
        $table = $this->db->sessionTable();
        $pk = DynamoKeys::session($sessionId);
        $item = $this->db->get($table, $pk, self::SK);

        if (! $item) {
            return null;
        }

        $this->closeSession($sessionId, $item, $endReason);

        return [
            'sessionId' => $sessionId,
            'status' => 'completed',
            'logout_time' => $this->now(),
            'endReason' => $endReason,
        ];
    }

    /**
     * Revoke a session by an admin with an explicit reason.
     */
    public function revokeSession(string $sessionId, string $reason): void
    {
        $table = $this->db->sessionTable();
        $pk = DynamoKeys::session($sessionId);
        $item = $this->db->get($table, $pk, self::SK);

        if (! $item) {
            return;
        }

        $now = $this->now();

        try {
            $this->db->patch($table, $pk, self::SK, [
                'status' => 'revoked',
                'logout_time' => $now,
                'revocation_reason' => $reason,
            ]);
        } catch (\Throwable $e) {
            Log::warning('SessionLogWriter: revoke patch failed', [
                'sessionId' => $sessionId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Sweep stale active sessions (last_heartbeat older than STALE_MINUTES)
     * and return the count of genuinely active sessions.
     */
    public function sweepAndCount(): int
    {
        $table = $this->db->sessionTable();
        $cutoff = $this->staleCutoff();

        // Use the STATUS-based GSI (GSI3) that already exists on the table
        $staleResult = $this->db->query($table, [
            'IndexName' => 'GSI3',
            'KeyConditionExpression' => 'GSI3PK = :pk AND GSI3SK < :cutoff',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => 'STATUS#active'],
                ':cutoff' => ['S' => $cutoff],
            ],
        ], null, 100);

        foreach ($staleResult['items'] as $staleItem) {
            try {
                $sid = (string) ($staleItem['session_id'] ?? '');

                if ($sid !== '') {
                    $this->closeSession($sid, $staleItem, 'timed_out');
                }
            } catch (\Throwable $e) {
                Log::warning('SessionLogWriter: sweep close failed', ['error' => $e->getMessage()]);
            }
        }

        return $this->db->count($table, [
            'IndexName' => 'GSI3',
            'KeyConditionExpression' => 'GSI3PK = :pk AND GSI3SK >= :cutoff',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => 'STATUS#active'],
                ':cutoff' => ['S' => $cutoff],
            ],
        ]);
    }

    /**
     * Count active sessions (public alias used by LogMonitorController).
     */
    public function countActiveSessions(): int
    {
        return $this->sweepAndCount();
    }

    /**
     * Open a session or extend the existing active one (used by activity.log middleware).
     *
     * @param  array<array{path: string, timestamp: string}>  $newPages
     * @return array{sessionId: string, status: string}
     */
    public function open(
        Request $request,
        string $sub,
        string $userName,
        string $userEmail,
        string $userRole,
        int $authTime,
        array $newPages = [],
    ): array {
        $base = $this->deriveBase($sub, $authTime);

        return $this->resolveChain(
            base: $base,
            sub: $sub,
            userName: $userName,
            userEmail: $userEmail,
            userRole: $userRole,
            ipAddress: $this->clientIp($request),
            userAgent: (string) $request->userAgent(),
            newPages: $newPages,
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Walk the chain base → base#2 → base#3 … to find the current session state.
     *
     * @param  array<array{path: string, timestamp: string}>  $newPages
     * @return array{sessionId: string, status: string, isNewSession: bool}
     */
    private function resolveChain(
        string $base,
        string $sub,
        string $userName,
        string $userEmail,
        string $userRole,
        string $ipAddress,
        string $userAgent,
        array $newPages,
    ): array {
        $table = $this->db->sessionTable();
        $latest = null;
        $depth = 0;
        $maxDepth = 10; // sanity cap

        for ($n = 0; $n <= $maxDepth; $n++) {
            $candidateId = $n === 0 ? $base : $base.'#'.($n + 1);
            $pk = DynamoKeys::session($candidateId);
            $item = $this->db->get($table, $pk, self::SK);

            if ($item === null) {
                $depth = $n;
                break;
            }

            $latest = $item;
        }

        // Case A: no session at all — create base
        if ($latest === null) {
            return $this->createSession(
                $base, $base, $sub, $userName, $userEmail, $userRole,
                $ipAddress, $userAgent, $newPages, $table,
            );
        }

        // Case B: latest session is active
        if (($latest['status'] ?? '') === 'active') {
            if ($this->isStale($latest)) {
                $existingId = (string) ($latest['session_id'] ?? $base);
                $this->closeSession($existingId, $latest, 'timed_out');
                // Fall through to Case C
            } else {
                // Healthy active: extend it
                $existingId = (string) ($latest['session_id'] ?? $base);
                $pagesVisited = is_array($latest['pages_visited'] ?? null) ? $latest['pages_visited'] : [];
                $truncated = (bool) ($latest['pages_visited_truncated'] ?? false);
                [$pagesVisited, $truncated] = $this->appendPages($pagesVisited, $newPages, $truncated);

                $now = $this->now();
                $loginTime = (string) ($latest['login_time'] ?? $now);
                $set = [
                    'last_heartbeat' => $now,
                    'duration_seconds' => max(0, strtotime($now) - strtotime($loginTime)),
                ];

                if ($newPages !== []) {
                    $set['pages_visited'] = $pagesVisited;
                    $set['pages_visited_truncated'] = $truncated;
                    $set['events_count'] = ($latest['events_count'] ?? 0) + count($newPages);
                }

                try {
                    $pk = DynamoKeys::session($existingId);
                    $this->db->patch($table, $pk, self::SK, $set);
                } catch (\Throwable $e) {
                    Log::warning('SessionLogWriter: extend failed', ['error' => $e->getMessage()]);
                }

                return ['sessionId' => $existingId, 'status' => 'active', 'isNewSession' => false];
            }
        }

        // Case C: latest is ended/revoked/timed_out (or was stale and just closed) — create next slot
        $newSuffix = $depth === 0 ? $base : $base.'#'.($depth + 1);

        return $this->createSession(
            $newSuffix, $base, $sub, $userName, $userEmail, $userRole,
            $ipAddress, $userAgent, $newPages, $table,
        );
    }

    /**
     * Attempt to create a new session item with a conditional put (attribute_not_exists).
     * Retries with the next suffix on a race condition.
     *
     * @param  array<array{path: string, timestamp: string}>  $newPages
     * @return array{sessionId: string, status: string, isNewSession: bool}
     */
    private function createSession(
        string $newId,
        string $base,
        string $sub,
        string $userName,
        string $userEmail,
        string $userRole,
        string $ipAddress,
        string $userAgent,
        array $newPages,
        string $table,
    ): array {
        $now = $this->now();
        $ttl = $this->ttl();
        [$pagesVisited, $truncated] = $this->appendPages([], $newPages, false);

        $yearMonth = substr($now, 0, 7); // YYYY-MM
        $deviceInfo = $this->parseDeviceInfo($userAgent);

        $maxRetries = 5;

        for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
            $tryId = $attempt === 0 ? $newId : $base.'#'.($this->suffixNumber($newId) + $attempt);
            $pk = DynamoKeys::session($tryId);

            $item = [
                'PK' => $pk,
                'SK' => self::SK,
                // Plan §2.2 canonical fields
                'session_id' => $tryId,
                'sub' => $sub,
                'user_name' => $userName,
                'user_email' => $userEmail,
                'user_role' => $userRole,
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'device_info' => $deviceInfo,
                'status' => 'active',
                'login_time' => $now,
                'logout_time' => null,
                'last_heartbeat' => $now,
                'duration_seconds' => 0,
                'pages_visited' => $pagesVisited,
                'pages_visited_truncated' => $truncated,
                'events_count' => count($newPages),
                'end_reason' => null,
                'revocation_reason' => null,
                'TTL' => $ttl,
                // GSI1: monthly-bucketed session log (plan §2.1)
                'GSI1PK' => DynamoKeys::sessionGsi1($yearMonth),
                'GSI1SK' => $now,
                // GSI2: per-user session history (plan §2.1)
                'GSI2PK' => 'USER#'.$sub,
                'GSI2SK' => $now,
                // GSI3: active-session sweep index (existing pattern, kept for sweepAndCount)
                'GSI3PK' => 'STATUS#active',
                'GSI3SK' => $now,
            ];

            $created = $this->db->putConditional($table, $item, 'attribute_not_exists(PK)');

            if ($created) {
                return ['sessionId' => $tryId, 'status' => 'active', 'isNewSession' => true];
            }
        }

        Log::warning('SessionLogWriter: could not create session after retries', ['base' => $base, 'sub' => $sub]);

        return ['sessionId' => $newId, 'status' => 'active', 'isNewSession' => false];
    }

    /**
     * Close a session by patching status, logout_time, and GSI3 to the ended partition.
     *
     * @param  array<string, mixed>  $item
     */
    private function closeSession(string $sessionId, array $item, string $reason): void
    {
        $table = $this->db->sessionTable();
        $pk = DynamoKeys::session($sessionId);

        // Map internal reason → plan status values
        $statusMap = [
            'logout' => 'completed',
            'tab_closed' => 'completed',
            'timed_out' => 'timed_out',
            'timeout' => 'timed_out',
            'revoked' => 'revoked',
        ];
        $status = $statusMap[$reason] ?? 'completed';

        $isStaleTimeout = in_array($status, ['timed_out', 'revoked'], true);
        $logoutTime = $isStaleTimeout
            ? (string) ($item['last_heartbeat'] ?? $this->now())
            : $this->now();

        $loginTime = (string) ($item['login_time'] ?? $logoutTime);
        $durationSeconds = max(0, strtotime($logoutTime) - strtotime($loginTime));

        try {
            $this->db->patch($table, $pk, self::SK, [
                'status' => $status,
                'logout_time' => $logoutTime,
                'duration_seconds' => $durationSeconds,
                'end_reason' => $reason,
                'GSI3PK' => 'STATUS#'.$status,
                'GSI3SK' => $logoutTime,
            ]);
        } catch (\Throwable $e) {
            Log::warning('SessionLogWriter: close patch failed', [
                'sessionId' => $sessionId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Append new page entries, deduplicating consecutive same-path entries and
     * honouring the MAX_PAGES cap.
     *
     * @param  list<array<string, mixed>>  $existing
     * @param  array<array{path: string, timestamp: string}>  $newPages
     * @return array{0: list<array<string, mixed>>, 1: bool} [pages, truncated]
     */
    private function appendPages(array $existing, array $newPages, bool $alreadyTruncated): array
    {
        if ($alreadyTruncated || $newPages === []) {
            return [$existing, $alreadyTruncated];
        }

        $lastPath = ! empty($existing) ? (string) ($existing[count($existing) - 1]['path'] ?? '') : '';

        foreach ($newPages as $page) {
            if (count($existing) >= self::MAX_PAGES) {
                return [$existing, true];
            }

            $path = (string) ($page['path'] ?? '');

            if ($path === $lastPath) {
                continue; // skip consecutive duplicate
            }

            $existing[] = $page;
            $lastPath = $path;
        }

        return [$existing, false];
    }

    /**
     * Parse a minimal device_info map from the User-Agent string.
     *
     * @return array{browser: string, os: string, device_type: string}
     */
    private function parseDeviceInfo(string $userAgent): array
    {
        $ua = strtolower($userAgent);

        $browser = match (true) {
            str_contains($ua, 'edg/') => 'Edge',
            str_contains($ua, 'opr/') => 'Opera',
            str_contains($ua, 'firefox/') => 'Firefox',
            str_contains($ua, 'chrome/') => 'Chrome',
            str_contains($ua, 'safari/') => 'Safari',
            default => 'Unknown',
        };

        $os = match (true) {
            str_contains($ua, 'windows') => 'Windows',
            str_contains($ua, 'macintosh') || str_contains($ua, 'mac os') => 'macOS',
            str_contains($ua, 'iphone') => 'iOS',
            str_contains($ua, 'android') => 'Android',
            str_contains($ua, 'linux') => 'Linux',
            default => 'Unknown',
        };

        $deviceType = match (true) {
            str_contains($ua, 'mobile') || str_contains($ua, 'iphone') || str_contains($ua, 'android') => 'mobile',
            str_contains($ua, 'tablet') || str_contains($ua, 'ipad') => 'tablet',
            default => 'desktop',
        };

        return ['browser' => $browser, 'os' => $os, 'device_type' => $deviceType];
    }

    private function isStale(array $item): bool
    {
        $lastHeartbeat = (string) ($item['last_heartbeat'] ?? '');

        if ($lastHeartbeat === '') {
            return true;
        }

        return strtotime($lastHeartbeat) < (time() - self::STALE_MINUTES * 60);
    }

    private function staleCutoff(): string
    {
        return now()->utc()->subMinutes(self::STALE_MINUTES)->format('Y-m-d\TH:i:s\Z');
    }

    private function deriveBase(string $sub, int $authTime): string
    {
        return hash('sha256', $sub.':'.$authTime);
    }

    /** Extract the numeric suffix from an ID like base#3 → 3, or base → 1. */
    private function suffixNumber(string $id): int
    {
        if (str_contains($id, '#')) {
            return (int) substr($id, strrpos($id, '#') + 1);
        }

        return 1;
    }

    private function clientIp(Request $request): string
    {
        return self::resolveClientIp($request);
    }

    private function now(): string
    {
        return now()->utc()->format('Y-m-d\TH:i:s\Z');
    }

    private function ttl(): int
    {
        $days = (int) config('aws.dynamodb.log_retention_days', 90);

        return time() + ($days * 86400);
    }
}
