<?php

namespace App\Aws\DynamoDb;

/**
 * Section 3 of a post-evaluation: the attendance roster and participant
 * evaluations captured by the arcus companion apps against this event.
 *
 * All three apps share one physical table, and the arcus apps write their rows
 * as children of the apex EVENT partition:
 *   - arcus-attendance  -> PK=EVENT#{id}, SK=MEMBER#{studentId}   (check-ins)
 *   - arcus-evaluation  -> PK=EVENT#{id}, SK=EVALUATION#{evalId}  (filings)
 * A single query on the EVENT partition therefore yields both datasets; member
 * names are resolved from the MEMBER#{studentId} profile items (PK=SK).
 *
 * The result is frozen onto the POSTEVAL item at submit time so the snapshot a
 * submitter filed with never drifts as later scans/evaluations arrive.
 */
final class AggregateEventParticipants
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return array{
     *     attendance_count: int,
     *     attendance: list<array<string, mixed>>,
     *     evaluation_count: int,
     *     evaluations: list<array<string, mixed>>
     * }
     */
    public function handle(string $eventId): array
    {
        $items = $this->items->query([
            'KeyConditionExpression' => 'PK = :pk',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::event($eventId)],
            ],
        ]);

        $checkIns = [];
        $evaluations = [];

        foreach ($items as $item) {
            $sk = (string) ($item['SK'] ?? '');

            if (str_starts_with($sk, 'MEMBER#')) {
                $checkIns[] = $item;
            } elseif (str_starts_with($sk, 'EVALUATION#')) {
                $evaluations[] = $item;
            }
        }

        $attendance = $this->attendanceRoster($checkIns);
        $evaluationRows = array_map($this->evaluationRow(...), $evaluations);

        return [
            'attendance_count' => count($attendance),
            'attendance' => $attendance,
            'evaluation_count' => count($evaluationRows),
            'evaluations' => $evaluationRows,
        ];
    }

    /**
     * Resolve each check-in against its MEMBER profile (PK=SK=MEMBER#{studentId}).
     *
     * @param  list<array<string, mixed>>  $checkIns
     * @return list<array<string, mixed>>
     */
    private function attendanceRoster(array $checkIns): array
    {
        $roster = [];

        foreach ($checkIns as $checkIn) {
            $sk = (string) ($checkIn['SK'] ?? '');
            $studentId = DynamoKeys::strip($sk, 'MEMBER#') ?? '';
            $member = $studentId !== '' ? $this->items->get($sk, $sk) : null;
            $member = is_array($member) ? $member : [];

            $roster[] = [
                'student_id' => $this->stringOr($member['student_id'] ?? null, $studentId),
                'full_name' => $this->stringOr($member['full_name'] ?? null, ''),
                'department' => $this->stringOr($member['department'] ?? null, ''),
                'member_organization' => $this->stringOr($checkIn['member_organization'] ?? null, ''),
                'scanned_at' => $this->stringOr($checkIn['scannedAt'] ?? null, ''),
                'left_at' => $this->stringOr($checkIn['leftAt'] ?? null, ''),
            ];
        }

        return $roster;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function evaluationRow(array $item): array
    {
        $evaluationId = $this->stringOr(
            $item['evaluationId'] ?? $item['evaluation_id'] ?? null,
            DynamoKeys::strip($item['SK'] ?? null, 'EVALUATION#') ?? '',
        );

        return [
            'evaluation_id' => $evaluationId,
            'student_id' => $this->stringOr($item['studentId'] ?? $item['student_id'] ?? null, ''),
            'full_name' => $this->stringOr($item['fullName'] ?? $item['full_name'] ?? null, ''),
            'participated' => $this->participatedFlag($item['participated'] ?? null),
            'filed_at' => $this->stringOr($item['filedAt'] ?? $item['filed_at'] ?? null, ''),
        ];
    }

    /**
     * arcus-evaluation stores participation as the string "yes"/"no"; a plain
     * `(bool)` cast would turn "no" into true. Normalize both that string and a
     * real boolean so the snapshot reflects what the respondent actually chose.
     */
    private function participatedFlag(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_string($value)) {
            return strtolower($value) === 'yes';
        }

        return false;
    }

    private function stringOr(mixed $value, string $default): string
    {
        if (is_string($value) && $value !== '') {
            return $value;
        }

        if (is_array($value) && is_string($value['S'] ?? null) && $value['S'] !== '') {
            return $value['S'];
        }

        return $default;
    }
}
