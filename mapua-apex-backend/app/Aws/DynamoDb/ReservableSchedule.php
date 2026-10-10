<?php

namespace App\Aws\DynamoDb;

use Carbon\CarbonImmutable;

/**
 * Canonical reservable schedule math.
 *
 * A reservable's weekly template is 6 day columns (monday..saturday; Sunday is
 * never reservable) x 12 slots. The reservation window is 07:00-21:00 split into
 * 70-minute slots, which yields exactly 12 slots (slot 11 = 19:50-21:00). The
 * frontend mirrors this in lib/schedule-slots.ts so indices/times never drift.
 */
final class ReservableSchedule
{
    public const SLOTS = 12;

    public const INTERVAL_MINUTES = 70;

    public const WINDOW_START_MINUTES = 7 * 60; // 07:00

    /**
     * @var list<string>
     */
    public const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    /**
     * @return list<string>
     */
    public static function days(): array
    {
        return self::DAYS;
    }

    public static function slotCount(): int
    {
        return self::SLOTS;
    }

    public static function isValidSlot(mixed $slot): bool
    {
        return is_int($slot) && $slot >= 0 && $slot < self::SLOTS;
    }

    /**
     * Absolute minutes from midnight for a slot's start.
     */
    public static function slotStartMinutes(int $slot): int
    {
        return self::WINDOW_START_MINUTES + ($slot * self::INTERVAL_MINUTES);
    }

    public static function slotStart(int $slot): string
    {
        return self::formatMinutes(self::slotStartMinutes($slot));
    }

    public static function slotEnd(int $slot): string
    {
        return self::formatMinutes(self::slotStartMinutes($slot) + self::INTERVAL_MINUTES);
    }

    /**
     * Human label for a slot, e.g. "07:00-08:10".
     */
    public static function slotLabel(int $slot): string
    {
        return self::slotStart($slot).'-'.self::slotEnd($slot);
    }

    /**
     * Map a concrete Y-m-d date to its weekday key, or null when not reservable
     * (Sunday, or an unparseable date).
     */
    public static function dayKeyForDate(string $date): ?string
    {
        try {
            $parsed = CarbonImmutable::parse($date);
        } catch (\Throwable) {
            return null;
        }

        $key = strtolower($parsed->format('l'));

        return in_array($key, self::DAYS, true) ? $key : null;
    }

    /**
     * Normalize/validate a submitted weekly schedule into the canonical 6x12
     * boolean shape. Absent days are all-unavailable; each day is padded or
     * truncated to exactly 12 booleans.
     *
     * @param  mixed  $schedule
     * @return array<string, list<bool>>
     */
    public static function normalize(mixed $schedule): array
    {
        $input = is_array($schedule) ? $schedule : [];
        $normalized = [];

        foreach (self::DAYS as $day) {
            $slots = $input[$day] ?? [];
            $slots = is_array($slots) ? $slots : [];
            $row = [];

            for ($i = 0; $i < self::SLOTS; $i++) {
                $row[] = (bool) ($slots[$i] ?? false);
            }

            $normalized[$day] = $row;
        }

        return $normalized;
    }

    /**
     * Whether the weekly template marks a given date's slot as available.
     *
     * @param  array<string, mixed>  $schedule
     */
    public static function templateAllows(array $schedule, string $date, int $slot): bool
    {
        if (! self::isValidSlot($slot)) {
            return false;
        }

        $day = self::dayKeyForDate($date);

        if ($day === null) {
            return false;
        }

        $row = $schedule[$day] ?? null;

        if (! is_array($row)) {
            return false;
        }

        return (bool) ($row[$slot] ?? false);
    }

    private static function formatMinutes(int $minutes): string
    {
        return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
    }
}
