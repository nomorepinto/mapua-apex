<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Logging\SessionLogWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionController extends Controller
{
    public function __construct(
        private readonly SessionLogWriter $sessionLogWriter
    ) {}

    public function start(Request $request): JsonResponse
    {
        $user = $request->attributes->get('cognito_user');
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $res = $this->sessionLogWriter->startSession(
            sub: $user['sub'],
            authTime: (int) ($user['auth_time'] ?? time()),
            userName: $user['name'] ?? $user['email'] ?? 'Unknown User',
            userEmail: $user['email'] ?? 'unknown@mapua.edu.ph',
            userRole: $user['role'] ?? 'unknown',
            ipAddress: $request->ip() ?? '127.0.0.1',
            userAgent: $request->userAgent() ?? 'Unknown'
        );

        return response()->json($res, 200);
    }

    public function heartbeat(Request $request, string $sessionId): JsonResponse
    {
        $user = $request->attributes->get('cognito_user');
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (!SessionLogWriter::verifySessionOwnership($sessionId, $user['sub'])) {
            return response()->json(['error' => 'Forbidden: Session ID mismatch'], 403);
        }

        $res = $this->sessionLogWriter->heartbeat($sessionId, $user['sub']);
        if (!$res) {
            return response()->json([
                'error' => 'Session expired or invalid',
                'code' => 'SESSION_EXPIRED',
            ], 409);
        }

        return response()->json($res, 200);
    }

    public function end(Request $request, string $sessionId): JsonResponse
    {
        $user = $request->attributes->get('cognito_user');
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if (!SessionLogWriter::verifySessionOwnership($sessionId, $user['sub'])) {
            return response()->json(['error' => 'Forbidden: Session ID mismatch'], 403);
        }

        $endReason = $request->input('endReason', 'logout');
        if (!in_array($endReason, ['logout', 'timeout', 'tab_closed', 'expired'], true)) {
            $endReason = 'logout';
        }

        $res = $this->sessionLogWriter->endSession($sessionId, $endReason);
        if (!$res) {
            return response()->json(['error' => 'Session not found'], 404);
        }

        return response()->json($res, 200);
    }
}
