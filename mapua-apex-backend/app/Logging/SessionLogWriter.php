<?php

namespace App\Logging;

use App\Aws\DynamoDb\DynamoKeys;
use Aws\DynamoDb\Exception\DynamoDbException;
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
     * @param  string|null  $existingSessionId  Session ID already held by the client (from localStorage).
     *                                          When provided and it matches the active DynamoDB session,
     *                                          the session is resumed rather than replaced.
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
        array $pagesVisited = [],
        ?string $existingSessionId = null,
        ?string $deviceId = null,
        int $retryCount = 0,
    ): array {
        $table = $this->db->sessionTable();
        $now = $this->now();
        $ttl = $this->ttl();
        $base = $this->deriveBase($sub, $authTime);

        // 1. Read the pointer USER#{sub} / ACTIVE_SESSION using getActiveSessionPointer($sub) with ConsistentRead: true
        $pointer = $this->db->getActiveSessionPointer($sub);

        // Branch 1: Pointer exists and device_id matches the request (or existingSessionId matches pointer session_id)
        if ($pointer !== null && ! empty($pointer['session_id'])) {
            $pointerSessionId = (string) $pointer['session_id'];
            $pointerDeviceId = isset($pointer['device_id']) && is_string($pointer['device_id']) ? $pointer['device_id'] : null;

            $matchesDevice = ($deviceId !== null && $deviceId !== '' && $pointerDeviceId === $deviceId)
                || ($existingSessionId !== null && $existingSessionId === $pointerSessionId);

            if ($matchesDevice) {
                $pk = DynamoKeys::session($pointerSessionId);
                $item = $this->db->get($table, $pk, self::SK);

                if ($item !== null && ($item['status'] ?? '') === 'active') {
                    if ($this->isStale($item)) {
                        $this->closeSession($pointerSessionId, $item, 'timed_out');
                        $this->db->clearActiveSessionPointerIfMatches($sub, $pointerSessionId);
                        $pointer = null; // Stale session closed, proceed to create a new session
                    } else {
                        // Reuse that session, refresh last_heartbeat, close nothing, return displacedPreviousSession = false
                        $pages = is_array($item['pages_visited'] ?? null) ? $item['pages_visited'] : [];
                        $truncated = (bool) ($item['pages_visited_truncated'] ?? false);
                        [$pages, $truncated] = $this->appendPages($pages, $pagesVisited, $truncated);

                        $loginTime = (string) ($item['login_time'] ?? $now);
                        $set = [
                            'last_heartbeat' => $now,
                            'duration_seconds' => max(0, strtotime($now) - strtotime($loginTime)),
                            'GSI3SK' => $now,
                        ];

                        if ($pagesVisited !== []) {
                            $set['pages_visited'] = $pages;
                            $set['pages_visited_truncated'] = $truncated;
                            $set['events_count'] = ($item['events_count'] ?? 0) + count($pagesVisited);
                        }

                        try {
                            $this->db->patch($table, $pk, self::SK, $set);
                            $this->db->patch($table, DynamoKeys::user($sub), DynamoKeys::activeSessionSk(), [
                                'last_heartbeat' => $now,
                            ]);
                        } catch (\Throwable $e) {
                            Log::warning('SessionLogWriter: reuse session patch failed', ['error' => $e->getMessage()]);
                        }

                        return [
                            'sessionId' => $pointerSessionId,
                            'login_time' => $loginTime,
                            'status' => 'active',
                            'isNewSession' => false,
                            'displacedPreviousSession' => false,
                        ];
                    }
                }
            }
        }

        // Branch 3: Pointer exists and device_id differs (displace the old session with one TransactWriteItems)
        if ($pointer !== null && ! empty($pointer['session_id'])) {
            $oldSessionId = (string) $pointer['session_id'];

            // Fetch old session to check if still active
            $oldItem = $this->db->get($table, DynamoKeys::session($oldSessionId), self::SK);

            // If the old session is stale (last_heartbeat > STALE_MINUTES ago), close it as timed_out
            // and clear the pointer rather than displacing it as a concurrent login.
            if ($oldItem !== null && ($oldItem['status'] ?? '') === 'active' && $this->isStale($oldItem)) {
                $this->closeSession($oldSessionId, $oldItem, 'timed_out');
                $this->db->clearActiveSessionPointerIfMatches($sub, $oldSessionId);
                $pointer = null;
            } else {
                $newId = $this->findAvailableSessionId($base, $table);
                $newSessionItem = $this->buildSessionItem(
                    $newId, $base, $sub, $userName, $userEmail, $userRole,
                    $ipAddress, $userAgent, $pagesVisited, $deviceId, $now, $ttl
                );

                $oldIsActive = ($oldItem !== null && ($oldItem['status'] ?? '') === 'active');

                $transactItems = [];

                // 1. Update the pointer to the new session_id and device_id, condition: session_id = :oldSessionId
                $pointerUpdateNames = [
                    '#sid' => 'session_id',
                    '#status' => 'status',
                    '#login' => 'login_time',
                    '#hb' => 'last_heartbeat',
                    '#ttl' => 'TTL',
                ];
                $pointerUpdateValues = [
                    ':newSid' => $newId,
                    ':status' => 'active',
                    ':now' => $now,
                    ':ttl' => $ttl,
                    ':oldSid' => $oldSessionId,
                ];
                $pointerSet = '#sid = :newSid, #status = :status, #login = :now, #hb = :now, #ttl = :ttl';
                if ($deviceId !== null && trim($deviceId) !== '') {
                    $pointerUpdateNames['#did'] = 'device_id';
                    $pointerUpdateValues[':did'] = trim($deviceId);
                    $pointerSet .= ', #did = :did';
                }

                $transactItems[] = $this->db->makeTransactUpdate(
                    $table,
                    DynamoKeys::user($sub),
                    DynamoKeys::activeSessionSk(),
                    'SET '.$pointerSet,
                    $pointerUpdateNames,
                    $pointerUpdateValues,
                    '#sid = :oldSid'
                );

                // 2. Create the new SESSION#{newId} item with status = active
                $transactItems[] = $this->db->makeTransactPut(
                    $table,
                    $newSessionItem,
                    'attribute_not_exists(PK)'
                );

                // 3. Update SESSION#{oldId} with status = completed, end_reason = concurrent_login, condition: status = active
                $displaced = false;
                if ($oldIsActive) {
                    $oldLoginTime = (string) ($oldItem['login_time'] ?? $now);
                    $durationSeconds = max(0, strtotime($now) - strtotime($oldLoginTime));

                    $transactItems[] = $this->db->makeTransactUpdate(
                        $table,
                        DynamoKeys::session($oldSessionId),
                        self::SK,
                        'SET #status = :status, end_reason = :reason, logout_time = :logout, duration_seconds = :dur, GSI3PK = :gsi3pk, GSI3SK = :logout',
                        ['#status' => 'status'],
                        [
                            ':status' => 'completed',
                            ':reason' => 'concurrent_login',
                            ':logout' => $now,
                            ':dur' => $durationSeconds,
                            ':gsi3pk' => 'STATUS#completed',
                            ':active' => 'active',
                        ],
                        '#status = :active'
                    );
                    $displaced = true;
                }

                try {
                    $this->db->transactWrite($transactItems);

                    return [
                        'sessionId' => $newId,
                        'login_time' => $now,
                        'status' => 'active',
                        'isNewSession' => true,
                        'displacedPreviousSession' => $displaced,
                    ];
                } catch (DynamoDbException $e) {
                    if ($e->getAwsErrorCode() === 'TransactionCanceledException' && $retryCount === 0) {
                        Log::info('SessionLogWriter: TransactionCanceledException on displace, retrying once', [
                            'sub' => $sub,
                        ]);

                        return $this->startSession(
                            $sub, $authTime, $userName, $userEmail, $userRole,
                            $ipAddress, $userAgent, $pagesVisited, $existingSessionId, $deviceId, $retryCount + 1
                        );
                    }
                    throw $e;
                }
            }
        }

        // Branch 2: No pointer: create the pointer (condition attribute_not_exists(PK)) and the new SESSION# item, then return displacedPreviousSession = false
        $newId = $this->findAvailableSessionId($base, $table);
        $newSessionItem = $this->buildSessionItem(
            $newId, $base, $sub, $userName, $userEmail, $userRole,
            $ipAddress, $userAgent, $pagesVisited, $deviceId, $now, $ttl
        );

        $pointerItem = [
            'PK' => DynamoKeys::user($sub),
            'SK' => DynamoKeys::activeSessionSk(),
            'sub' => $sub,
            'session_id' => $newId,
            'status' => 'active',
            'login_time' => $now,
            'last_heartbeat' => $now,
            'TTL' => $ttl,
        ];
        if ($deviceId !== null && trim($deviceId) !== '') {
            $pointerItem['device_id'] = trim($deviceId);
        }

        $transactItems = [
            $this->db->makeTransactPut($table, $newSessionItem, 'attribute_not_exists(PK)'),
            $this->db->makeTransactPut($table, $pointerItem, 'attribute_not_exists(PK)'),
        ];

        try {
            $this->db->transactWrite($transactItems);

            return [
                'sessionId' => $newId,
                'login_time' => $now,
                'status' => 'active',
                'isNewSession' => true,
                'displacedPreviousSession' => false,
            ];
        } catch (DynamoDbException $e) {
            if ($e->getAwsErrorCode() === 'TransactionCanceledException' && $retryCount === 0) {
                Log::info('SessionLogWriter: TransactionCanceledException on create, retrying once', [
                    'sub' => $sub,
                ]);

                return $this->startSession(
                    $sub, $authTime, $userName, $userEmail, $userRole,
                    $ipAddress, $userAgent, $pagesVisited, $existingSessionId, $deviceId, $retryCount + 1
                );
            }
            throw $e;
        }
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

        // Check if user's active pointer has already been claimed by another session
        $pointer = $this->db->getActiveSessionPointer($sub);
        if ($pointer !== null && ($pointer['session_id'] ?? '') !== $sessionId) {
            $pointerHeartbeat = (string) ($pointer['last_heartbeat'] ?? '');
            $isPointerFresh = $pointerHeartbeat !== '' && ! $this->isStaleTimestamp($pointerHeartbeat);

            $itemDeviceId = isset($item['device_id']) && is_string($item['device_id']) ? $item['device_id'] : null;
            $pointerDeviceId = isset($pointer['device_id']) && is_string($pointer['device_id']) ? $pointer['device_id'] : null;
            $isSameDevice = ($itemDeviceId !== null && $pointerDeviceId !== null && $itemDeviceId === $pointerDeviceId);

            // If another device holds a fresh active pointer, this session is displaced
            if ($isPointerFresh && ! $isSameDevice) {
                if (($item['status'] ?? '') === 'active') {
                    $this->closeSession($sessionId, $item, 'concurrent_login');
                }
                if (($item['end_reason'] ?? '') === 'admin_revoked') {
                    return 'revoked';
                }

                return 'displaced';
            }
        }

        // Stale-active check: if session is stale (and no other device holds a fresh pointer), return expired
        if (($item['status'] ?? '') === 'active' && $this->isStale($item)) {
            $this->closeSession($sessionId, $item, 'timed_out');
            $this->db->clearActiveSessionPointerIfMatches($sub, $sessionId);

            return 'expired';
        }

        if (($item['status'] ?? '') !== 'active') {
            if (($item['end_reason'] ?? '') === 'concurrent_login') {
                return 'displaced';
            }
            if (($item['end_reason'] ?? '') === 'admin_revoked') {
                return 'revoked';
            }

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
            if ($pointer !== null && ($pointer['session_id'] ?? '') === $sessionId) {
                $this->db->patch($table, DynamoKeys::user($sub), DynamoKeys::activeSessionSk(), [
                    'last_heartbeat' => $now,
                ]);
            }
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

        if (($item['status'] ?? '') !== 'active') {
            return ['ok']; // idempotent, already ended (completed, timed_out, or revoked)
        }

        $this->closeSession($sessionId, $item, $reason);
        $this->db->clearActiveSessionPointerIfMatches($sub, $sessionId);

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

        if (($item['status'] ?? '') !== 'active') {
            return [
                'sessionId' => $sessionId,
                'status' => (string) ($item['status'] ?? 'completed'),
                'logout_time' => (string) ($item['logout_time'] ?? $this->now()),
                'endReason' => (string) ($item['end_reason'] ?? $endReason),
            ];
        }

        $this->closeSession($sessionId, $item, $endReason);
        if (isset($item['sub']) && is_string($item['sub'])) {
            $this->db->clearActiveSessionPointerIfMatches($item['sub'], $sessionId);
        }

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
                'end_reason' => 'admin_revoked',
                'revocation_reason' => $reason,
                'GSI3PK' => 'STATUS#revoked',
                'GSI3SK' => $now,
            ]);
            if (isset($item['sub']) && is_string($item['sub'])) {
                $this->db->clearActiveSessionPointerIfMatches($item['sub'], $sessionId);
            }
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
                    if (isset($staleItem['sub']) && is_string($staleItem['sub'])) {
                        $this->db->clearActiveSessionPointerIfMatches($staleItem['sub'], $sid);
                    }
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
        return $this->startSession(
            sub: $sub,
            authTime: $authTime,
            userName: $userName,
            userEmail: $userEmail,
            userRole: $userRole,
            ipAddress: $this->clientIp($request),
            userAgent: (string) $request->userAgent(),
            pagesVisited: $newPages,
            existingSessionId: $request->header('X-Session-ID'),
            deviceId: $request->header('X-Device-ID'),
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    private function findAvailableSessionId(string $base, string $table): string
    {
        for ($n = 0; $n <= 10; $n++) {
            $candidateId = $n === 0 ? $base : $base.'#'.($n + 1);
            $pk = DynamoKeys::session($candidateId);
            $item = $this->db->get($table, $pk, self::SK);

            if ($item === null) {
                return $candidateId;
            }
        }

        return $base.'#'.time();
    }

    private function buildSessionItem(
        string $sessionId,
        string $base,
        string $sub,
        string $userName,
        string $userEmail,
        string $userRole,
        string $ipAddress,
        string $userAgent,
        array $newPages,
        ?string $deviceId,
        string $now,
        int $ttl,
    ): array {
        $deviceInfo = $this->parseDeviceInfo($userAgent);
        $yearMonth = substr($now, 0, 7);

        $pagesVisited = [];
        $truncated = false;
        if ($newPages !== []) {
            [$pagesVisited, $truncated] = $this->appendPages([], $newPages, false);
        }

        $item = [
            'PK' => DynamoKeys::session($sessionId),
            'SK' => self::SK,
            'session_id' => $sessionId,
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
            'GSI1PK' => DynamoKeys::sessionGsi1($yearMonth),
            'GSI1SK' => $now,
            'GSI2PK' => 'USER#'.$sub,
            'GSI2SK' => $now,
            'GSI3PK' => 'STATUS#active',
            'GSI3SK' => $now,
        ];

        if ($deviceId !== null && trim($deviceId) !== '') {
            $item['device_id'] = trim($deviceId);
        }

        return $item;
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
            'logout'           => 'completed',
            'tab_closed'       => 'completed',
            'timed_out'        => 'timed_out',
            'timeout'          => 'timed_out',
            'revoked'          => 'revoked',
            'concurrent_login' => 'completed',
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

    public function isStaleTimestamp(?string $timestamp): bool
    {
        if ($timestamp === null || trim($timestamp) === '') {
            return true;
        }

        return strtotime($timestamp) < (time() - self::STALE_MINUTES * 60);
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
