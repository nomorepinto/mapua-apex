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

    /**
     * @param  array{prefixes: list<string>, digits: int}|null  $classroomFormat  campus classroom naming rule
     */
    public static function campus(
        InMemoryDynamoDb $db,
        string $id = 'c001',
        string $name = 'Intramuros',
        ?array $classroomFormat = null,
    ): void {
        $item = [
            'PK' => 'CAMPUS#'.$id,
            'SK' => 'CAMPUS#'.$id,
            'name' => $name,
        ];

        if ($classroomFormat !== null) {
            $item['classroom_name_prefixes'] = $classroomFormat['prefixes'];
            $item['classroom_name_digits'] = $classroomFormat['digits'];
        }

        $db->seed($item);
    }

    /**
     * @param  array<string, list<bool>>|null  $schedule  defaults to all-available Mon-Sat
     * @param  array{min?: int, max?: int}|null  $capacity  room-only participant bounds
     */
    public static function reservable(
        InMemoryDynamoDb $db,
        string $campusId = 'c001',
        string $id = 'r001',
        string $name = 'Room 1',
        string $type = 'room',
        ?array $schedule = null,
        ?array $capacity = null,
    ): void {
        $item = [
            'PK' => 'CAMPUS#'.$campusId,
            'SK' => 'RESERVABLE#'.$id,
            'name' => $name,
            'type' => $type,
            'schedule' => $schedule ?? self::fullSchedule(),
        ];

        if ($capacity !== null) {
            $item['min_participants'] = $capacity['min'] ?? null;
            $item['max_participants'] = $capacity['max'] ?? null;
        }

        $db->seed($item);
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

    /**
     * A POSTEVAL item under an EVENT partition (also carries GSI1 for org discovery).
     *
     * @param  array<string, mixed>  $overrides
     */
    public static function postEval(InMemoryDynamoDb $db, array $overrides = []): void
    {
        $db->seed(array_merge([
            'PK' => 'EVENT#e001',
            'SK' => 'POSTEVAL#pe001',
            'entity_type' => 'posteval',
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'GSI1SK' => 'POSTEVAL#pe001',
            'organization_id' => 'a1b2',
            'event_id' => 'e001',
            'submission_id' => 's001',
            'status' => 'submitted',
            'submitted_at' => '2026-09-11T08:00:00Z',
            'event_title' => 'Hack Night: Intro to Web Dev',
            'section_summary' => 'The event ran smoothly and attendees were engaged throughout the night.',
            'financial_report' => [
                'budget_items' => [],
                'added_items' => [],
                'initial_grand_total' => 3000,
                'actual_grand_total' => 2800,
            ],
            'participation_snapshot' => [
                'attendance_count' => 0,
                'attendance' => [],
                'evaluation_count' => 0,
                'evaluations' => [],
            ],
        ], $overrides));
    }

    /**
     * A MEMBER profile item (PK=SK=MEMBER#{studentId}) used to resolve names.
     */
    public static function member(
        InMemoryDynamoDb $db,
        string $studentId,
        string $fullName = 'Juan Dela Cruz',
        string $department = 'CCIS',
    ): void {
        $db->seed([
            'PK' => 'MEMBER#'.$studentId,
            'SK' => 'MEMBER#'.$studentId,
            'student_id' => $studentId,
            'full_name' => $fullName,
            'department' => $department,
            'course' => 'BSCS',
            'current_organization' => 'a1b2',
        ]);
    }

    /**
     * An arcus-attendance check-in child of an EVENT partition (SK=MEMBER#{studentId}).
     */
    public static function checkIn(
        InMemoryDynamoDb $db,
        string $event,
        string $studentId,
        string $memberOrganization = 'a1b2',
        string $scannedAt = '08:00 AM',
    ): void {
        $db->seed([
            'PK' => 'EVENT#'.$event,
            'SK' => 'MEMBER#'.$studentId,
            'member_organization' => $memberOrganization,
            'scannedAt' => $scannedAt,
            'timestamp' => 1760000000000,
        ]);
    }

    /**
     * An arcus-evaluation filing child of an EVENT partition (SK=EVALUATION#{id}),
     * stored with the camelCase attributes arcus-evaluation writes.
     */
    public static function evaluation(
        InMemoryDynamoDb $db,
        string $event,
        string $evaluationId,
        string $studentId,
        string $fullName = 'Juan Dela Cruz',
        bool $participated = true,
    ): void {
        $db->seed([
            'PK' => 'EVENT#'.$event,
            'SK' => 'EVALUATION#'.$evaluationId,
            'entityType' => 'evaluation',
            'evaluationId' => $evaluationId,
            'studentId' => $studentId,
            'fullName' => $fullName,
            'participated' => $participated ? 'yes' : 'no',
            'filedAt' => '2026-09-11T09:00:00Z',
            'eventId' => $event,
        ]);
    }
}
