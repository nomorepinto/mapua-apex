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
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $pagesVisited = (array) $request->input('pagesVisited', []);

        $res = $this->sessionLogWriter->startSession(
            sub: $user['sub'],
            authTime: (int) ($user['auth_time'] ?? time()),
            userName: $user['name'] ?? $user['email'] ?? 'Unknown User',
            userEmail: $user['email'] ?? 'unknown@mapua.edu.ph',
            userRole: $user['role'] ?? 'unknown',
            ipAddress: SessionLogWriter::resolveClientIp($request),
            userAgent: $request->userAgent() ?? 'Unknown',
            pagesVisited: $pagesVisited,
        );

        return response()->json($res, 200);
    }

    public function heartbeat(Request $request, string $sessionId): JsonResponse
    {
        $user = $request->attributes->get('cognito_user');
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $pagesVisited = (array) $request->input('pagesVisited', []);

        $res = $this->sessionLogWriter->heartbeat($sessionId, $user['sub'], $pagesVisited);
        if ($res === 'forbidden') {
            return response()->json(['error' => 'Forbidden: Session ID mismatch'], 403);
        }

        if ($res !== 'ok') {
            return response()->json([
                'error' => 'Session expired or invalid',
                'code' => 'SESSION_EXPIRED',
            ], 409);
        }

        return response()->json(['sessionId' => $sessionId, 'status' => 'active'], 200);
    }

    public function end(Request $request, string $sessionId): JsonResponse
    {
        $user = $request->attributes->get('cognito_user');
        if (! $user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $reason = (string) ($request->input('reason') ?? $request->input('endReason') ?? 'logout');

        $res = $this->sessionLogWriter->end($sessionId, $user['sub'], $reason);
        if (isset($res[0])) {
            if ($res[0] === 'forbidden') {
                return response()->json(['error' => 'Forbidden: Session ID mismatch'], 403);
            }
            if ($res[0] === 'not_found') {
                return response()->json(['error' => 'Session not found'], 404);
            }
        }

        return response()->json(['sessionId' => $sessionId, 'status' => 'completed'], 200);
    }
}
