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
        private readonly SessionLogWriter $sessionLogWriter
    ) {}

    public function querySessions(Request $request): JsonResponse
    {
        $startDate = $request->query('startDate', date('Y-m-d'));
        $endDate = $request->query('endDate', date('Y-m-d'));
        $userId = $request->query('userId');
        $role = $request->query('role');
        $status = $request->query('status');
        $limit = (int) $request->query('limit', 50);
        $nextToken = $request->query('nextToken');

        $result = $this->logTableItems->querySessions(
            startDate: $startDate,
            endDate: $endDate,
            userId: $userId,
            role: $role,
            status: $status,
            limit: $limit,
            nextToken: $nextToken
        );

        return response()->json($result);
    }

    public function queryActivity(Request $request): JsonResponse
    {
        $startDate = $request->query('startDate', date('Y-m-d'));
        $endDate = $request->query('endDate', date('Y-m-d'));
        $userId = $request->query('userId');
        $role = $request->query('role');
        $actionType = $request->query('actionType');
        $module = $request->query('module');
        $limit = (int) $request->query('limit', 50);
        $nextToken = $request->query('nextToken');

        $result = $this->logTableItems->queryActivity(
            startDate: $startDate,
            endDate: $endDate,
            userId: $userId,
            role: $role,
            actionType: $actionType,
            module: $module,
            limit: $limit,
            nextToken: $nextToken
        );

        return response()->json($result);
    }

    public function getActivityDetail(Request $request, string $activityId): JsonResponse
    {
        $date = $request->query('date', date('Y-m-d'));
        $item = $this->logTableItems->getActivityItem($activityId, $date);

        if (!$item) {
            return response()->json(['error' => 'Activity log record not found'], 404);
        }

        return response()->json($item);
    }

    public function getStats(Request $request): JsonResponse
    {
        $today = date('Y-m-d');
        $activeSessionsCount = $this->sessionLogWriter->countActiveSessions();
        
        $todaySessions = $this->logTableItems->querySessions(
            startDate: $today,
            endDate: $today,
            limit: 1000
        );

        $todayActivity = $this->logTableItems->queryActivity(
            startDate: $today,
            endDate: $today,
            limit: 1000
        );

        return response()->json([
            'activeSessionsCount' => $activeSessionsCount,
            'totalSessionsToday' => count($todaySessions['items'] ?? []),
            'totalActivityToday' => count($todayActivity['items'] ?? []),
        ]);
    }
}
