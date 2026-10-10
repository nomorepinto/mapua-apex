<?php

namespace Tests\Support;

use Tests\Fakes\InMemoryDynamoDb;

final class DynamoFixtures
{
    /**
     * @param  list<array{role: string, signatory_id: string}>  $signatories
     */
    public static function organization(
        InMemoryDynamoDb $db,
        string $id = 'a1b2',
        string $name = 'Mapua Computing Society',
        array $signatories = [],
        bool $isHigherCouncil = false,
    ): void {
        $db->seed([
            'PK' => 'ORGANIZATION#'.$id,
            'SK' => 'ORGANIZATION#'.$id,
            'name' => $name,
            'signatories' => $signatories,
            'is_higher_council' => $isHigherCouncil,
        ]);
    }

    public static function event(InMemoryDynamoDb $db, string $org = 'a1b2', string $event = 'e001'): void
    {
        $db->seed([
            'PK' => 'EVENT#'.$event,
            'SK' => 'EVENT#'.$event,
            'sent_at' => '2026-09-01T09:00:00Z',
            'GSI1PK' => 'ORGANIZATION#'.$org,
            'GSI1SK' => '2026-09-01T09:00:00Z',
        ]);
    }

    public static function campus(InMemoryDynamoDb $db, string $id = 'c001', string $name = 'Intramuros'): void
    {
        $db->seed([
            'PK' => 'CAMPUS#'.$id,
            'SK' => 'CAMPUS#'.$id,
            'name' => $name,
        ]);
    }

    /**
     * @param  array<string, list<bool>>|null  $schedule  defaults to all-available Mon-Sat
     */
    public static function reservable(
        InMemoryDynamoDb $db,
        string $campusId = 'c001',
        string $id = 'r001',
        string $name = 'Room 1',
        string $type = 'room',
        ?array $schedule = null,
    ): void {
        $db->seed([
            'PK' => 'CAMPUS#'.$campusId,
            'SK' => 'RESERVABLE#'.$id,
            'name' => $name,
            'type' => $type,
            'schedule' => $schedule ?? self::fullSchedule(),
        ]);
    }

    /**
     * @param  list<array{date: string, slots: list<int>}>  $selections
     * @param  array<string, mixed>  $extra
     */
    public static function booking(
        InMemoryDynamoDb $db,
        string $reservableId,
        string $id,
        array $selections,
        string $source = 'submission',
        array $extra = [],
    ): void {
        $db->seed(array_merge([
            'PK' => 'RESERVABLE#'.$reservableId,
            'SK' => 'BOOKING#'.$id,
            'timestamp' => '2026-10-01T00:00:00Z',
            'schedule_selected' => $selections,
            'source' => $source,
        ], $extra));
    }

    /**
     * All 12 slots available across Mon-Sat.
     *
     * @return array<string, list<bool>>
     */
    public static function fullSchedule(): array
    {
        $schedule = [];

        foreach (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as $day) {
            $schedule[$day] = array_fill(0, 12, true);
        }

        return $schedule;
    }

    public static function signatory(
        InMemoryDynamoDb $db,
        string $id,
        string $role,
        string $org = 'a1b2',
        string $name = 'Prof. Juan Dela Cruz',
    ): void {
        $db->seed([
            'PK' => 'SIGNATORY#'.$id,
            'SK' => 'SIGNATORY#'.$id,
            'name' => $name,
            'role' => $role,
            'organization_id' => $org,
            'GSI4PK' => 'ROLE#'.strtoupper($role),
            'GSI4SK' => 'SIGNATORY#'.$id,
        ]);

        $organization = $db->find('ORGANIZATION#'.$org, 'ORGANIZATION#'.$org) ?? [];
        $desks = is_array($organization['signatories'] ?? null) ? $organization['signatories'] : [];
        $next = [];

        foreach ($desks as $desk) {
            if (! is_array($desk)) {
                continue;
            }

            if (($desk['role'] ?? null) === $role || ($desk['signatory_id'] ?? null) === $id) {
                continue;
            }

            $next[] = $desk;
        }

        $next[] = [
            'role' => $role,
            'signatory_id' => $id,
        ];

        self::organization(
            $db,
            $org,
            is_string($organization['name'] ?? null) ? $organization['name'] : 'Mapua Computing Society',
            $next,
            ($organization['is_higher_council'] ?? false) === true,
        );
    }

    public static function announcement(
        InMemoryDynamoDb $db,
        string $sentAt = '2026-09-15T08:00:00Z',
        string $content = 'OSAAR office hours are 9:00–17:00.',
    ): void {
        $db->seed([
            'PK' => 'ANNOUNCEMENT',
            'SK' => $sentAt,
            'content' => $content,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    public static function submission(InMemoryDynamoDb $db, array $overrides = []): void
    {
        $payload = SaafPayload::valid();
        unset($payload['event_id']);

        $db->seed(array_merge([
            'PK' => 'EVENT#e001',
            'SK' => 'SUBMISSION#s001',
            'submission_type' => 'saaf',
            'sent_at' => '2026-09-10T14:00:00Z',
            'status' => 'pending',
            'current_signatory' => 'SIGNATORY#adv001',
            'GSI2PK' => 'SIGNATORY#adv001',
            'GSI2SK' => '2026-09-10T14:00:00Z',
        ], $payload, $overrides));
    }
}
