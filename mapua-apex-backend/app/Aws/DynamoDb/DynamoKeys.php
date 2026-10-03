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

    public static function announcement(): string
    {
        return 'ANNOUNCEMENT';
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
