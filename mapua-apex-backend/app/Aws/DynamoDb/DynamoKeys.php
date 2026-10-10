<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

final class DynamoKeys
{
    public static function organization(string $id): string
    {
        return 'ORGANIZATION#'.self::strip($id, 'ORGANIZATION#');
    }

    public static function event(string $id): string
    {
        return 'EVENT#'.self::strip($id, 'EVENT#');
    }

    public static function submission(string $id): string
    {
        return 'SUBMISSION#'.self::strip($id, 'SUBMISSION#');
    }

    public static function signatory(string $id): string
    {
        return 'SIGNATORY#'.self::strip($id, 'SIGNATORY#');
    }

    public static function notification(string $timestamp): string
    {
        return 'NOTIFICATION#'.$timestamp;
    }

    public static function deadline(string $id): string
    {
        return 'DEADLINE#'.self::strip($id, 'DEADLINE#');
    }

    /**
     * Index-only sort key for a collaboration pointer in a dependent's ORGANIZATION partition.
     */
    public static function collaboration(string $eventId, string $submissionId): string
    {
        return 'COLLAB#'.self::strip($eventId, 'EVENT#').'#'.self::strip($submissionId, 'SUBMISSION#');
    }

    public static function announcement(): string
    {
        return 'ANNOUNCEMENT';
    }

    /**
     * PK for a session log item: SESSION#{session_id}
     */
    public static function session(string $sessionId): string
    {
        return 'SESSION#'.self::strip($sessionId, 'SESSION#');
    }

    /**
     * GSI1PK for monthly-bucketed session log queries: LOG#SESSION#{YYYY-MM}
     */
    public static function sessionGsi1(string $yearMonth): string
    {
        return 'LOG#SESSION#'.$yearMonth;
    }

    /**
     * PK for a user partition: USER#{sub}
     */
    public static function user(string $sub): string
    {
        return 'USER#'.self::strip($sub, 'USER#');
    }

    /**
     * SK for a user's active session pointer: ACTIVE_SESSION
     */
    public static function activeSessionSk(): string
    {
        return 'ACTIVE_SESSION';
    }

    public static function roleIndex(string $role, ?string $department = null): string
    {
        $key = 'ROLE#'.Str::upper($role);

        if (Str::lower($role) !== 'dean') {
            return $key;
        }

        $department = is_string($department) ? Str::upper(trim($department)) : '';

        if ($department === '') {
            return $key;
        }

        return $key.'#'.$department;
    }

    public static function strip(mixed $value, string $prefix): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        return Str::chopStart($value, $prefix);
    }

    public static function now(): string
    {
        return now()->utc()->format('Y-m-d\TH:i:s\Z');
    }
}
