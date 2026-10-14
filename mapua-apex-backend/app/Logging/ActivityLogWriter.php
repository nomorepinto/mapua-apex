<?php

namespace App\Logging;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Writes individual activity records to the ActivityLog DynamoDB table.
 */
final class ActivityLogWriter
{
    public function __construct(private readonly LogTableItems $db) {}

    // ─────────────────────────────────────────────────────────────────────
    // Auth activities (called by SessionLogWriter, not the middleware)
    // ─────────────────────────────────────────────────────────────────────

    public function writeLogin(
        string $sessionId,
        string $userId,
        string $userName,
        string $userEmail,
        string $userRole,
        string $ipAddress,
        ?string $timestamp = null,
    ): void {
        // Login events are recorded exclusively in SessionLog
    }

    public function writeLogout(
        string $sessionId,
        string $userId,
        string $userName,
        string $userEmail,
        string $userRole,
        string $ipAddress,
        ?string $timestamp = null,
    ): void {
        // Logout events are recorded exclusively in SessionLog
    }

    // ─────────────────────────────────────────────────────────────────────
    // Mutation activities (called by ActivityLogMiddleware)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function writeMutation(
        string $sessionId,
        string $userId,
        string $userName,
        string $userEmail,
        string $userRole,
        string $ipAddress,
        string $actionType,
        string $module,
        string $entityId,
        string $entityName,
        string $description,
        ?array $before,
        ?array $after,
        ?string $organizationName = null,
    ): void {
        $this->write([
            'sessionId'        => $sessionId,
            'userId'           => $userId,
            'userName'         => $userName,
            'userEmail'        => $userEmail,
            'userRole'         => $userRole,
            'ipAddress'        => $ipAddress,
            'timestamp'        => $this->now(),
            'actionType'       => $actionType,
            'module'           => $module,
            'entityId'         => $entityId,
            'entityName'       => $entityName,
            'organizationName' => $organizationName,
            'description'      => $description,
            'before'           => $before,
            'after'            => $after,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $data
     */
    private function write(array $data): void
    {
        try {
            $table      = $this->db->activityTable();
            $activityId = (string) Str::uuid();
            $timestamp  = $data['timestamp'] ?? $this->now();
            $pk         = 'ACTIVITY#'.$activityId;
            $sessionId  = (string) ($data['sessionId'] ?? '');
            $userId     = (string) ($data['userId'] ?? '');
            $module     = (string) ($data['module'] ?? '');

            $item = [
                'PK'               => $pk,
                'SK'               => $pk,
                'activityId'       => $activityId,
                'sessionId'        => $sessionId,
                'userId'           => $userId,
                'userName'         => (string) ($data['userName'] ?? ''),
                'userEmail'        => (string) ($data['userEmail'] ?? ''),
                'userRole'         => (string) ($data['userRole'] ?? ''),
                'timestamp'        => $timestamp,
                'ipAddress'        => (string) ($data['ipAddress'] ?? ''),
                'actionType'       => (string) ($data['actionType'] ?? ''),
                'module'           => $module,
                'entityId'         => (string) ($data['entityId'] ?? ''),
                'entityName'       => (string) ($data['entityName'] ?? ''),
                'organizationName' => (string) ($data['organizationName'] ?? ''),
                'description'      => (string) ($data['description'] ?? ''),
                'TTL'         => $this->ttl(),
                'GSI1PK'      => 'SESSION#'.$sessionId,
                'GSI1SK'      => $timestamp,
                'GSI2PK'      => 'USER#'.$userId,
                'GSI2SK'      => $timestamp,
                'GSI3PK'      => 'DATE#'.substr($timestamp, 0, 10),
                'GSI3SK'      => $timestamp,
                'GSI4PK'      => 'MODULE#'.$module,
                'GSI4SK'      => $timestamp,
            ];

            // Only include before/after if non-null and non-empty
            if (is_array($data['before'] ?? null) && $data['before'] !== []) {
                $item['before'] = $data['before'];
            }

            if (is_array($data['after'] ?? null) && $data['after'] !== []) {
                $item['after'] = $data['after'];
            }

            $this->db->put($table, $item);
        } catch (\Throwable $e) {
            // Logging must never break user actions
            Log::warning('ActivityLogWriter: failed to write activity', [
                'actionType' => $data['actionType'] ?? null,
                'module'     => $data['module'] ?? null,
                'error'      => $e->getMessage(),
            ]);
        }
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

    public function logMutation(...$args): void
    {
        $this->writeMutation(...$args);
    }

    public function logLogin(...$args): void
    {
        $this->writeLogin(...$args);
    }

    public function logLogout(...$args): void
    {
        $this->writeLogout(...$args);
    }
}
