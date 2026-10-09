<?php

namespace App\Support\Arcus;

use Carbon\CarbonImmutable;

/**
 * Stateless, per-request visibility windows for the arcus companion apps.
 *
 * The server keeps no scheduler, cron, or stored "open" flag: an approved
 * event's accessibility is derived on every request from its stored
 * activity_details.date_of_event against the current time in Asia/Manila.
 * Attendance opens at the start of the event day and closes at its end;
 * evaluation opens at the same moment and stays open for a configurable
 * number of days after the event.
 */
final class EventWindow
{
    public const TIMEZONE = 'Asia/Manila';

    public const ATTENDANCE = 'attendance';

    public const EVALUATION = 'evaluation';

    /**
     * @param  array<string, mixed>  $submission
     * @return array{opens_at: string|null, closes_at: string|null, is_open: bool}
     */
    public static function for(array $submission, string $window, ?int $windowDays = null, ?CarbonImmutable $now = null): array
    {
        $date = self::dateOfEvent($submission);
        $opens = self::opensAt($date);
        $closes = self::closesAt($date, $window, $windowDays);
        $now ??= CarbonImmutable::now(self::TIMEZONE);

        $isOpen = $opens !== null
            && $closes !== null
            && $now->greaterThanOrEqualTo($opens)
            && $now->lessThanOrEqualTo($closes);

        return [
            'opens_at' => $opens?->toIso8601String(),
            'closes_at' => $closes?->toIso8601String(),
            'is_open' => $isOpen,
        ];
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    public static function isOpenNow(array $submission, string $window, ?int $windowDays = null, ?CarbonImmutable $now = null): bool
    {
        return self::for($submission, $window, $windowDays, $now)['is_open'];
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    public static function dateOfEvent(array $submission): ?string
    {
        $date = data_get($submission, 'activity_details.date_of_event');

        return is_string($date) && $date !== '' ? $date : null;
    }

    public static function opensAt(?string $date): ?CarbonImmutable
    {
        return $date === null ? null : CarbonImmutable::parse($date, self::TIMEZONE)->startOfDay();
    }

    public static function closesAt(?string $date, string $window, ?int $windowDays = null): ?CarbonImmutable
    {
        if ($date === null) {
            return null;
        }

        $end = CarbonImmutable::parse($date, self::TIMEZONE)->endOfDay();

        if ($window === self::EVALUATION) {
            $days = $windowDays ?? (int) config('services.arcus.post_evaluation_window_days', 3);
            $end = $end->addDays($days);
        }

        return $end;
    }
}
