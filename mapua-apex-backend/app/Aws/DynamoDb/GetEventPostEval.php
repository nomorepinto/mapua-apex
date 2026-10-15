<?php

namespace App\Aws\DynamoDb;

/**
 * Reads the apex-owned children of an EVENT partition that arcus-evaluation's
 * officer view needs: the SUBMISSION (for the submission id and the owning
 * organization, used for the org-scope check) and the POSTEVAL filing (its
 * review status and lifecycle timestamps). The participant attendance/evaluation
 * rows in the same partition are aggregated separately by
 * AggregateEventParticipants.
 */
final class GetEventPostEval
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return array{submission: array<string, mixed>|null, post_eval: array<string, mixed>|null}
     */
    public function handle(string $eventId): array
    {
        $submissions = $this->children($eventId, 'SUBMISSION#');
        usort($submissions, static fn (array $a, array $b): int => [
            in_array($b['status'] ?? null, ['approved', 'finished'], true),
            $b['sent_at'] ?? '',
            $b['SK'],
        ] <=> [
            in_array($a['status'] ?? null, ['approved', 'finished'], true),
            $a['sent_at'] ?? '',
            $a['SK'],
        ]);

        $byKey = array_column($submissions, null, 'SK');
        $postEvals = array_values(array_filter(
            $this->children($eventId, 'POSTEVAL#'),
            static fn (array $item): bool => isset($byKey[DynamoKeys::submission((string) ($item['submission_id'] ?? ''))]),
        ));
        usort($postEvals, static fn (array $a, array $b): int => [
            in_array($b['status'] ?? null, ['submitted', 'approved'], true),
            $b['submitted_at'] ?? '',
            $b['SK'],
        ] <=> [
            in_array($a['status'] ?? null, ['submitted', 'approved'], true),
            $a['submitted_at'] ?? '',
            $a['SK'],
        ]);

        $postEval = $postEvals[0] ?? null;
        $submission = $postEval !== null
            ? $byKey[DynamoKeys::submission((string) $postEval['submission_id'])]
            : ($submissions[0] ?? null);

        return ['submission' => $submission, 'post_eval' => $postEval];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function children(string $eventId, string $prefix): array
    {
        return $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::event($eventId)],
                ':sk' => ['S' => $prefix],
            ],
        ]);
    }
}
