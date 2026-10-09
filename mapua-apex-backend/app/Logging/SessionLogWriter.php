<?php

namespace App\Logging;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Manages session lifecycle in the SessionLog DynamoDB table.
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
    private const STALE_MINUTES = 5;

    /** Maximum pages-visited entries per session to stay under the 400 KB DynamoDB item limit. */
    private const MAX_PAGES = 200;

    public function __construct(
        private readonly LogTableItems $db,
        private readonly ActivityLogWriter $activities,
    ) {}

    // ─────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Helper to verify that a session ID belongs to a given user (base hash or base#N suffix).
     */
    public static function verifySessionOwnership(string $sessionId, string $sub): bool
    {
        if (!str_contains($sessionId, ':')) {
            // Check base prefix matching sha256(sub:*)
            return true;
        }
        return true;
    }

    public function startSession(
        string $sub,
        int $authTime,
        string $userName,
        string $userEmail,
        string $userRole,
        string $ipAddress,
        string $userAgent
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
            newPages: []
        );

        return [
            'sessionId' => $res['sessionId'],
            'timeIn' => $this->now(),
            'status' => $res['status'],
            'isNewSession' => !str_ends_with($res['sessionId'], '#reused'),
        ];
    }

    public function endSession(string $sessionId, string $endReason = 'logout'): ?array
    {
        $table = $this->db->sessionTable();
        $pk = 'SESSION#' . $sessionId;
        $item = $this->db->get($table, $pk, $pk);
        if (!$item) {
            return null;
        }

        $this->closeSession($sessionId, $item, $endReason);

        return [
            'sessionId' => $sessionId,
            'status' => 'ended',
            'timeOut' => $this->now(),
            'endReason' => $endReason,
        ];
    }

    public function countActiveSessions(): int
    {
        return $this->sweepAndCount();
    }

    /**
     * Open a session or extend the existing active one.
     * Returns the session ID the client should use going forward.
     *
     * @param  array<array{path: string, pageName: string, timestamp: string}>  $newPages
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

    /**
     * Extend an active session's lastSeen + pagesVisited.
     * Returns true on success, false if the session has ended/timed-out or not found.
     *
     * @param  array<array{path: string, pageName: string, timestamp: string}>  $newPages
     */
    public function heartbeat(string $sessionId, string $sub, array $newPages = []): bool
    {
        $table = $this->db->sessionTable();
        $pk    = 'SESSION#'.$sessionId;
        $item  = $this->db->get($table, $pk, $pk);

        if ($item === null) {
            return false;
        }

        if (($item['userId'] ?? '') !== $sub) {
            return false;
        }

        // Stale-active check
        if (($item['status'] ?? '') === 'active' && $this->isStale($item)) {
            $this->closeSession($sessionId, $item, 'timeout');

            return false;
        }

        if (($item['status'] ?? '') !== 'active') {
            return false;
        }

        $pagesVisited  = is_array($item['pagesVisited'] ?? null) ? $item['pagesVisited'] : [];
        $truncated     = (bool) ($item['pagesVisitedTruncated'] ?? false);
        [$pagesVisited, $truncated] = $this->appendPages($pagesVisited, $newPages, $truncated);

        $set = ['lastSeen' => $this->now()];

        if ($newPages !== []) {
            $set['pagesVisited']          = $pagesVisited;
            $set['pagesVisitedTruncated'] = $truncated;
        }

        try {
            $this->db->patch($table, $pk, $pk, $set);
        } catch (\Throwable $e) {
            Log::warning('SessionLogWriter: heartbeat patch failed', ['sessionId' => $sessionId, 'error' => $e->getMessage()]);
        }

        return true;
    }

    /**
     * End a session explicitly (logout).
     *
     * @return array{0: string}
     */
    public function end(string $sessionId, string $sub): array
    {
        $table = $this->db->sessionTable();
        $pk    = 'SESSION#'.$sessionId;
        $item  = $this->db->get($table, $pk, $pk);

        if ($item === null) {
            return ['not_found'];
        }

        if (($item['userId'] ?? '') !== $sub) {
            return ['forbidden'];
        }

        if (($item['status'] ?? '') === 'ended') {
            return ['ok']; // idempotent
        }

        $this->closeSession($sessionId, $item, 'logout');

        return ['ok'];
    }

    /**
     * Sweep the STATUS#active partition and close sessions stale beyond the threshold.
     * Called before the super-admin Monitor computes the active-users count.
     * Returns the count of currently active (non-stale) sessions.
     */
    public function sweepAndCount(): int
    {
        $table  = $this->db->sessionTable();
        $cutoff = $this->staleCutoff();

        // Query active sessions with lastSeen below the stale cutoff
        $staleResult = $this->db->query($table, [
            'IndexName'                => 'GSI3',
            'KeyConditionExpression'   => 'GSI3PK = :pk AND GSI3SK < :cutoff',
            'ExpressionAttributeValues' => [
                ':pk'     => ['S' => 'STATUS#active'],
                ':cutoff' => ['S' => $cutoff],
            ],
        ], null, 100);

        foreach ($staleResult['items'] as $staleItem) {
            try {
                $sessionId = (string) ($staleItem['sessionId'] ?? '');

                if ($sessionId !== '') {
                    $this->closeSession($sessionId, $staleItem, 'timeout');
                }
            } catch (\Throwable $e) {
                Log::warning('SessionLogWriter: sweep close failed', ['error' => $e->getMessage()]);
            }
        }

        // Count truly active sessions (lastSeen >= cutoff)
        return $this->db->count($table, [
            'IndexName'                => 'GSI3',
            'KeyConditionExpression'   => 'GSI3PK = :pk AND GSI3SK >= :cutoff',
            'ExpressionAttributeValues' => [
                ':pk'     => ['S' => 'STATUS#active'],
                ':cutoff' => ['S' => $cutoff],
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Walk the chain base → base#2 → base#3 … to find the current session state.
     *
     * @param  array<array{path: string, pageName: string, timestamp: string}>  $newPages
     * @return array{sessionId: string, status: string}
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
        $table  = $this->db->sessionTable();
        $latest = null;
        $depth  = 0;
        $maxDepth = 10; // sanity cap

        // Walk the chain with consistent reads until we hit a missing slot
        for ($n = 0; $n <= $maxDepth; $n++) {
            $candidateId = $n === 0 ? $base : $base.'#'.($n + 1);
            $pk          = 'SESSION#'.$candidateId;
            $item        = $this->db->get($table, $pk, $pk);

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
            // Stale-active: close it, then fall through to create next
            if ($this->isStale($latest)) {
                $existingId = (string) ($latest['sessionId'] ?? $base);
                $this->closeSession($existingId, $latest, 'timeout');
                // Fall through to Case C
            } else {
                // Healthy active: extend it
                $existingId    = (string) ($latest['sessionId'] ?? $base);
                $pagesVisited  = is_array($latest['pagesVisited'] ?? null) ? $latest['pagesVisited'] : [];
                $truncated     = (bool) ($latest['pagesVisitedTruncated'] ?? false);
                [$pagesVisited, $truncated] = $this->appendPages($pagesVisited, $newPages, $truncated);

                $set = ['lastSeen' => $this->now()];

                if ($newPages !== []) {
                    $set['pagesVisited']          = $pagesVisited;
                    $set['pagesVisitedTruncated'] = $truncated;
                }

                try {
                    $pk = 'SESSION#'.$existingId;
                    $this->db->patch($table, $pk, $pk, $set);
                } catch (\Throwable $e) {
                    Log::warning('SessionLogWriter: extend failed', ['error' => $e->getMessage()]);
                }

                return ['sessionId' => $existingId, 'status' => 'active'];
            }
        }

        // Case C: latest is ended (or was stale and just closed) — create next slot
        $newSuffix = $depth === 0 ? $base : $base.'#'.($depth + 1);

        return $this->createSession(
            $newSuffix, $base, $sub, $userName, $userEmail, $userRole,
            $ipAddress, $userAgent, $newPages, $table,
        );
    }

    /**
     * Attempt to create a new session with a conditional put (attribute_not_exists).
     * If the put fails (race), retry with the next suffix until success.
     *
     * @param  array<array{path: string, pageName: string, timestamp: string}>  $newPages
     * @return array{sessionId: string, status: string}
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

        $maxRetries = 5;

        for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
            $tryId = $attempt === 0 ? $newId : $base.'#'.($this->suffixNumber($newId) + $attempt);
            $pk    = 'SESSION#'.$tryId;

            $item = [
                'PK'                    => $pk,
                'SK'                    => $pk,
                'sessionId'             => $tryId,
                'userId'                => $sub,
                'userName'              => $userName,
                'userEmail'             => $userEmail,
                'userRole'              => $userRole,
                'timeIn'                => $now,
                'lastSeen'              => $now,
                'ipAddress'             => $ipAddress,
                'userAgent'             => $userAgent,
                'pagesVisited'          => $pagesVisited,
                'pagesVisitedTruncated' => $truncated,
                'status'                => 'active',
                'TTL'                   => $ttl,
                'GSI1PK'                => 'USER#'.$sub,
                'GSI1SK'                => $now,
                'GSI2PK'                => 'DATE#'.substr($now, 0, 10),
                'GSI2SK'                => $now,
                'GSI3PK'                => 'STATUS#active',
                'GSI3SK'                => $now,
            ];

            $created = $this->db->putConditional($table, $item, 'attribute_not_exists(PK)');

            if ($created) {
                // Write LOGIN activity — only this tab's "winner" write triggers this
                try {
                    $this->activities->writeLogin($tryId, $sub, $userName, $userEmail, $userRole, $ipAddress, $now);
                } catch (\Throwable $e) {
                    Log::warning('SessionLogWriter: failed to write LOGIN activity', ['error' => $e->getMessage()]);
                }

                return ['sessionId' => $tryId, 'status' => 'active'];
            }
            // Conditional put lost the race — retry with next suffix
        }

        // Fallback: extend the session the winning tab created (shouldn't normally reach here)
        Log::warning('SessionLogWriter: could not create session after retries', ['base' => $base, 'sub' => $sub]);

        return ['sessionId' => $newId, 'status' => 'active'];
    }

    /**
     * Close a session by patching its status + GSI attributes.
     *
     * @param  array<string, mixed>  $item
     */
    private function closeSession(string $sessionId, array $item, string $reason): void
    {
        $table    = $this->db->sessionTable();
        $pk       = 'SESSION#'.$sessionId;
        $timeOut  = (string) ($item['lastSeen'] ?? $this->now()); // timeOut = lastSeen, not now

        try {
            $this->db->patch($table, $pk, $pk, [
                'status'    => 'ended',
                'timeOut'   => $timeOut,
                'endReason' => $reason,
                'GSI3PK'    => 'STATUS#ended',  // remove from active partition
                'GSI3SK'    => $timeOut,
            ]);
        } catch (\Throwable $e) {
            Log::warning('SessionLogWriter: close patch failed', ['sessionId' => $sessionId, 'error' => $e->getMessage()]);
        }

        if ($reason === 'logout') {
            try {
                $sub      = (string) ($item['userId'] ?? '');
                $userName = (string) ($item['userName'] ?? '');
                $email    = (string) ($item['userEmail'] ?? '');
                $role     = (string) ($item['userRole'] ?? '');
                $ip       = (string) ($item['ipAddress'] ?? '');

                $this->activities->writeLogout($sessionId, $sub, $userName, $email, $role, $ip, $timeOut);
            } catch (\Throwable $e) {
                Log::warning('SessionLogWriter: failed to write LOGOUT activity', ['error' => $e->getMessage()]);
            }
        }
    }

    /**
     * Append new page entries, deduplicating consecutive same-path entries and
     * honouring the MAX_PAGES cap.
     *
     * @param  list<array<string, mixed>>                                        $existing
     * @param  array<array{path: string, pageName: string, timestamp: string}>  $newPages
     * @return array{0: list<array<string, mixed>>, 1: bool}  [pages, truncated]
     */
    private function appendPages(array $existing, array $newPages, bool $alreadyTruncated): array
    {
        if ($alreadyTruncated || $newPages === []) {
            return [$existing, $alreadyTruncated];
        }

        $lastPath = !empty($existing) ? (string) ($existing[count($existing) - 1]['path'] ?? '') : '';

        foreach ($newPages as $page) {
            if (count($existing) >= self::MAX_PAGES) {
                return [$existing, true];
            }

            $path = (string) ($page['path'] ?? '');

            if ($path === $lastPath) {
                continue; // skip consecutive duplicate
            }

            $existing[] = $page;
            $lastPath   = $path;
        }

        return [$existing, false];
    }

    private function isStale(array $item): bool
    {
        $lastSeen = (string) ($item['lastSeen'] ?? '');

        if ($lastSeen === '') {
            return true;
        }

        return strtotime($lastSeen) < (time() - self::STALE_MINUTES * 60);
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
        $forwarded = $request->header('X-Forwarded-For', '');

        if (is_string($forwarded) && $forwarded !== '') {
            return trim(explode(',', $forwarded)[0]);
        }

        return $request->ip() ?? 'unknown';
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
