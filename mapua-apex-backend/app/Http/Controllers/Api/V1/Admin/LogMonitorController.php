<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Logging\LogTableItems;
use App\Logging\SessionLogWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogMonitorController extends Controller
{
    public function __construct(
        private readonly LogTableItems $logTableItems,
        private readonly SessionLogWriter $sessionLogWriter,
    ) {}

    // ─────────────────────────────────────────────────────────────────────
    // Session endpoints
    // ─────────────────────────────────────────────────────────────────────

    public function querySessions(Request $request): JsonResponse
    {
        $rawStart = $request->query('startDate');
        $rawEnd = $request->query('endDate');

        $startDate = is_string($rawStart) && trim($rawStart) !== '' ? trim($rawStart) : date('Y-m-d');
        $endDate = is_string($rawEnd) && trim($rawEnd) !== '' ? trim($rawEnd) : date('Y-m-d');

        if (strcmp($startDate, $endDate) > 0) {
            $tmp = $startDate;
            $startDate = $endDate;
            $endDate = $tmp;
        }

        $userId = $request->query('userId');
        $role = $request->query('role');
        $status = $request->query('status');
        $limit = min((int) $request->query('limit', 50), 200);
        $nextToken = $request->query('nextToken');

        $result = $this->logTableItems->querySessions(
            startDate: $startDate,
            endDate: $endDate,
            userId: is_string($userId) && trim($userId) !== '' ? trim($userId) : null,
            role: is_string($role) && trim($role) !== '' ? trim($role) : null,
            status: is_string($status) && trim($status) !== '' ? trim($status) : null,
            limit: $limit,
            nextToken: is_string($nextToken) && trim($nextToken) !== '' ? trim($nextToken) : null,
        );

        return response()->json(['data' => $result['items'], 'nextToken' => $result['nextToken']]);
    }

    public function getSessionDetail(Request $request, string $id): JsonResponse
    {
        $item = $this->logTableItems->getSessionItem($id);

        if (! $item) {
            return response()->json(['error' => 'Session log record not found'], 404);
        }

        return response()->json(['data' => $item]);
    }

    public function revokeSession(Request $request, string $id): JsonResponse
    {
        $reason = (string) $request->input('reason', 'admin_revoked');

        $item = $this->logTableItems->getSessionItem($id);

        if (! $item) {
            return response()->json(['error' => 'Session not found'], 404);
        }

        $this->sessionLogWriter->revokeSession($id, $reason);

        return response()->json(['data' => ['sessionId' => $id, 'status' => 'revoked', 'revocation_reason' => $reason]]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Activity endpoints
    // ─────────────────────────────────────────────────────────────────────

    public function queryActivity(Request $request): JsonResponse
    {
        $rawStart = $request->query('startDate');
        $rawEnd = $request->query('endDate');

        $startDate = is_string($rawStart) && trim($rawStart) !== '' ? trim($rawStart) : date('Y-m-d');
        $endDate = is_string($rawEnd) && trim($rawEnd) !== '' ? trim($rawEnd) : date('Y-m-d');

        if (strcmp($startDate, $endDate) > 0) {
            $tmp = $startDate;
            $startDate = $endDate;
            $endDate = $tmp;
        }

        $userId = $request->query('userId');
        $role = $request->query('role');
        $actionType = $request->query('actionType');
        $module = $request->query('module');
        $limit = min((int) $request->query('limit', 50), 200);
        $nextToken = $request->query('nextToken');

        $result = $this->logTableItems->queryActivity(
            startDate: $startDate,
            endDate: $endDate,
            userId: is_string($userId) && trim($userId) !== '' ? trim($userId) : null,
            role: is_string($role) && trim($role) !== '' ? trim($role) : null,
            actionType: is_string($actionType) && trim($actionType) !== '' ? trim($actionType) : null,
            module: is_string($module) && trim($module) !== '' ? trim($module) : null,
            limit: $limit,
            nextToken: is_string($nextToken) && trim($nextToken) !== '' ? trim($nextToken) : null,
        );

        return response()->json(['data' => $result['items'], 'nextToken' => $result['nextToken']]);
    }

    public function getActivityDetail(Request $request, string $activityId): JsonResponse
    {
        $item = $this->logTableItems->getActivityItem($activityId);

        if (! $item) {
            return response()->json(['error' => 'Activity log record not found'], 404);
        }

        return response()->json(['data' => $item]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Analytics endpoints
    // ─────────────────────────────────────────────────────────────────────

    public function getStats(Request $request): JsonResponse
    {
        $today = date('Y-m-d');
        $activeSessionsCount = $this->sessionLogWriter->countActiveSessions();

        $todaySessions = $this->logTableItems->querySessions(
            startDate: $today,
            endDate: $today,
            limit: 1000,
        );

        $todayActivity = $this->logTableItems->queryActivity(
            startDate: $today,
            endDate: $today,
            limit: 1000,
        );

        // Role distribution from today's sessions
        $roleDistribution = [];
        foreach ($todaySessions['items'] as $session) {
            $role = (string) ($session['user_role'] ?? 'unknown');
            $roleDistribution[$role] = ($roleDistribution[$role] ?? 0) + 1;
        }

        return response()->json([
            'data' => [
                'activeSessionsCount' => $activeSessionsCount,
                'totalSessionsToday' => count($todaySessions['items'] ?? []),
                'totalActivityToday' => count($todayActivity['items'] ?? []),
                'roleDistribution' => $roleDistribution,
            ],
        ]);
    }

    public function getBottlenecks(Request $request): JsonResponse
    {
        // Bottleneck analysis: find sessions with long duration and low events_count,
        // or submissions stuck awaiting signatory action (future: cross-reference with submission data).
        $today = date('Y-m-d');

        $sessions = $this->logTableItems->querySessions(
            startDate: $today,
            endDate: $today,
            status: 'active',
            limit: 500,
        );

        // Flag sessions idle for > 30 minutes but still active
        $idleThreshold = 30 * 60; // seconds
        $now = time();
        $bottlenecks = [];

        foreach ($sessions['items'] as $session) {
            $lastHeartbeat = strtotime((string) ($session['last_heartbeat'] ?? ''));
            $idleSeconds = $lastHeartbeat ? ($now - $lastHeartbeat) : 0;

            if ($idleSeconds > $idleThreshold) {
                $bottlenecks[] = [
                    'session_id' => $session['session_id'] ?? null,
                    'user_name' => $session['user_name'] ?? null,
                    'user_role' => $session['user_role'] ?? null,
                    'idle_seconds' => $idleSeconds,
                    'last_heartbeat' => $session['last_heartbeat'] ?? null,
                ];
            }
        }

        return response()->json(['data' => $bottlenecks]);
    }
}
