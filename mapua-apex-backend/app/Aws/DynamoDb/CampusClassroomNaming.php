<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

/**
 * Classroom naming rules carried on a CAMPUS item.
 *
 * A campus may define how its classroom rooms are named: a set of allowed
 * prefix tokens (e.g. MPO, N, W, S, E, NW, SW, SE, NE) plus a required digit
 * count. A room flagged classroom must then be named exactly
 * "<one prefix><N digits>" (case-insensitive). Campuses without a format simply
 * enforce nothing (and cannot host classroom rooms). Mirrored on the frontend by
 * lib/campus-classroom-format.ts so the CDM form and the API never drift.
 */
final class CampusClassroomNaming
{
    public const MAX_PREFIXES = 30;

    public const MAX_DIGITS = 4;

    /**
     * Whether a campus item defines a usable classroom naming format.
     *
     * @param  array<string, mixed>  $campus
     */
    public static function hasFormat(array $campus): bool
    {
        return self::prefixes($campus) !== [] && self::digits($campus) !== null;
    }

    /**
     * @param  array<string, mixed>  $campus
     * @return list<string>
     */
    public static function prefixes(array $campus): array
    {
        $raw = $campus['classroom_name_prefixes'] ?? null;

        return is_array($raw) ? self::normalizePrefixes($raw) : [];
    }

    /**
     * @param  array<string, mixed>  $campus
     */
    public static function digits(array $campus): ?int
    {
        $raw = $campus['classroom_name_digits'] ?? null;

        return is_numeric($raw) ? (int) $raw : null;
    }

    /**
     * Whether a classroom name matches "<prefix><N digits>" for one of the
     * allowed prefixes. Returns false when no format is supplied.
     *
     * @param  list<string>|null  $prefixes
     */
    public static function matches(?array $prefixes, ?int $digits, string $name): bool
    {
        $prefixes = $prefixes === null ? [] : self::normalizePrefixes($prefixes);

        if ($prefixes === [] || $digits === null || $digits < 1) {
            return false;
        }

        $trimmed = trim($name);

        foreach ($prefixes as $prefix) {
            $pattern = '/^'.preg_quote($prefix, '/').'\d{'.$digits.'}$/i';

            if (preg_match($pattern, $trimmed) === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Human description of the required format, or null when none is set.
     *
     * @param  list<string>|null  $prefixes
     */
    public static function hint(?array $prefixes, ?int $digits): ?string
    {
        $prefixes = $prefixes === null ? [] : self::normalizePrefixes($prefixes);

        if ($prefixes === [] || $digits === null) {
            return null;
        }

        return implode(' / ', $prefixes).' followed by exactly '.$digits.' digits';
    }

    /**
     * Uppercase, trim, drop empties and duplicates; keep insertion order.
     *
     * @param  iterable<mixed>  $prefixes
     * @return list<string>
     */
    public static function normalizePrefixes(iterable $prefixes): array
    {
        $seen = [];
        $result = [];

        foreach ($prefixes as $prefix) {
            if (! is_string($prefix)) {
                continue;
            }

            $token = Str::upper(trim($prefix));

            if ($token === '' || isset($seen[$token])) {
                continue;
            }

            $seen[$token] = true;
            $result[] = $token;
        }

        return $result;
    }
}
