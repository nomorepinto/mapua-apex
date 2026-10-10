<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * Resolves an inclusive [start, end] availability window from a request's
 * `start`/`end` query params, defaulting to today..+60 days.
 */
final class AvailabilityWindow
{
    private const DEFAULT_SPAN_DAYS = 60;

    /**
     * @return array{start: string, end: string}
     */
    public static function resolve(Request $request): array
    {
        $start = $request->query('start');
        $end = $request->query('end');

        $start = is_string($start) && self::isDate($start) ? $start : null;
        $end = is_string($end) && self::isDate($end) ? $end : null;

        if ($request->query('start') !== null && $start === null) {
            abort(422, 'The start date must be a valid date (YYYY-MM-DD).');
        }

        if ($request->query('end') !== null && $end === null) {
            abort(422, 'The end date must be a valid date (YYYY-MM-DD).');
        }

        $start ??= CarbonImmutable::now()->toDateString();
        $end ??= CarbonImmutable::parse($start)->addDays(self::DEFAULT_SPAN_DAYS)->toDateString();

        if ($end < $start) {
            abort(422, 'The end date must be on or after the start date.');
        }

        return ['start' => $start, 'end' => $end];
    }

    private static function isDate(string $value): bool
    {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1;
    }
}
