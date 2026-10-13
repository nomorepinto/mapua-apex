<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

/**
 * Reservation change requests: a student asks CDM to cancel or reschedule the
 * holds on an approved paper, and CDM resolves it. Each request is logically
 * tied to the concrete BOOKING records it targets (snapshotted at request time)
 * and keeps a full before/after audit trail (`applied`) once resolved.
 *
 * Keys:
 *   PK  = EVENT#uuid
 *   SK  = RESERVATION_CHANGE#uuid
 *   GSI6PK = CAMPUS#uuid          (CDM per-campus queue)
 *   GSI6SK = status#requested_at  (pending#..., resolved#..., denied#...)
 *
 * GSI6 is provisioned in AWS by the operator, mirroring how GSI5 backs the
 * organization booking index.
 */
final class ReservationChangeRecords
{
    public const STATUSES = ['pending', 'resolved', 'denied'];

    public function __construct(private DynamoDbItems $items) {}

    /**
     * Write a pending change request. The bookings snapshot freezes exactly
     * which holds the request targets so it stays interpretable even if the
     * paper's holds shift before resolution.
     *
     * @param  list<array<string, mixed>>  $bookings
     * @return array<string, mixed>
     */
    public function create(
        string $eventId,
        string $submissionId,
        string $organizationId,
        string $campusId,
        string $requestedBy,
        string $requestType,
        string $reason,
        array $bookings,
        ?string $suggestedDate = null,
    ): array {
        $changeId = (string) Str::uuid();
        $requestedAt = DynamoKeys::now();

        $item = [
            'PK' => DynamoKeys::event($eventId),
            'SK' => DynamoKeys::reservationChange($changeId),
            'GSI6PK' => DynamoKeys::campus($campusId),
            'GSI6SK' => 'pending#'.$requestedAt,
            'item_type' => 'reservation_change',
            'organization_id' => $organizationId,
            'submission_id' => $submissionId,
            'campus_id' => $campusId,
            'requested_by' => $requestedBy,
            'requested_at' => $requestedAt,
            'request_type' => $requestType,
            'reason' => $reason,
            'bookings' => array_values($bookings),
            'status' => 'pending',
        ];

        if (is_string($suggestedDate) && $suggestedDate !== '') {
            $item['suggested_date'] = $suggestedDate;
        }

        $this->items->put($item);

        return $item;
    }

    /**
     * All change requests for a submission (base-table query), newest first.
     *
     * @return list<array<string, mixed>>
     */
    public function listForSubmission(string $eventId, string $submissionId): array
    {
        $items = $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::event($eventId)],
                ':sk' => ['S' => 'RESERVATION_CHANGE#'],
            ],
        ]);

        $items = array_values(array_filter(
            $items,
            static fn (array $item): bool => ($item['submission_id'] ?? null) === $submissionId
                || DynamoKeys::strip($item['SK'] ?? null, 'SUBMISSION#') === $submissionId,
        ));

        return $this->sortNewestFirst($items);
    }

    public function hasPending(string $eventId, string $submissionId): bool
    {
        foreach ($this->listForSubmission($eventId, $submissionId) as $item) {
            if (($item['status'] ?? null) === 'pending') {
                return true;
            }
        }

        return false;
    }

    /**
     * CDM queue for a campus via GSI6, optionally filtered to one status,
     * newest first.
     *
     * @return list<array<string, mixed>>
     */
    public function listForCampus(string $campusId, ?string $status = null): array
    {
        $items = $this->items->query([
            'IndexName' => 'GSI6',
            'KeyConditionExpression' => 'GSI6PK = :pk',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::campus($campusId)],
            ],
        ]);

        if (is_string($status) && $status !== '' && $status !== 'all') {
            $items = array_values(array_filter(
                $items,
                static fn (array $item): bool => ($item['status'] ?? null) === $status,
            ));
        }

        return $this->sortNewestFirst($items);
    }

    /**
     * A single change request within a campus (GSI6 partition scan, matched by
     * its bare uuid). The admin routes only carry the campus + change id, so the
     * EVENT partition key is recovered from the found item.
     *
     * @return array<string, mixed>|null
     */
    public function findForCampus(string $campusId, string $changeId): ?array
    {
        $target = DynamoKeys::reservationChange($changeId);

        foreach ($this->listForCampus($campusId) as $item) {
            if (($item['SK'] ?? null) === $target) {
                return $item;
            }
        }

        return null;
    }

    /**
     * Persist the resolution onto the change item. Uses a conditional put on
     * `resolved_at` so a second, concurrent resolve of the same request cannot
     * finalize twice (best-effort; callers also re-check status up front).
     *
     * @param  array<string, mixed>  $change
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed>
     */
    public function finalize(array $change, array $fields): array
    {
        $status = (string) ($fields['status'] ?? 'resolved');
        $requestedAt = (string) ($change['requested_at'] ?? DynamoKeys::now());

        $updated = array_merge($change, $fields, [
            'status' => $status,
            'GSI6SK' => $status.'#'.$requestedAt,
        ]);

        $this->items->put($updated, 'attribute_not_exists(resolved_at)');

        return $updated;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    private function sortNewestFirst(array $items): array
    {
        usort($items, static fn (array $a, array $b): int => strcmp(
            (string) ($b['requested_at'] ?? ''),
            (string) ($a['requested_at'] ?? ''),
        ));

        return $items;
    }
}
