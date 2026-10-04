<?php

namespace App\Aws\DynamoDb;

/**
 * Index-only pointers that make a proponent's submission discoverable in each
 * dependent organization's dashboard. The submission and its notifications stay
 * stored once under the proponent's EVENT partition; these rows merely reference
 * it (PK = ORGANIZATION#<depId>, SK = COLLAB#<eventId>#<submissionId>).
 */
final class CollaborationRecords
{
    public function __construct(private DynamoDbItems $items) {}

    public function put(string $organizationId, string $eventId, string $submissionId, string $sentAt): void
    {
        $this->items->put([
            'PK' => DynamoKeys::organization($organizationId),
            'SK' => DynamoKeys::collaboration($eventId, $submissionId),
            'event_id' => DynamoKeys::strip(DynamoKeys::event($eventId), 'EVENT#'),
            'submission_id' => DynamoKeys::strip(DynamoKeys::submission($submissionId), 'SUBMISSION#'),
            'sent_at' => $sentAt,
        ]);
    }

    public function remove(string $organizationId, string $eventId, string $submissionId): void
    {
        $this->items->delete(
            DynamoKeys::organization($organizationId),
            DynamoKeys::collaboration($eventId, $submissionId),
        );
    }

    /**
     * @return list<array{event_id: string, submission_id: string, sent_at: string}>
     */
    public function listForOrganization(string $organizationId): array
    {
        $rows = $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::organization($organizationId)],
                ':sk' => ['S' => 'COLLAB#'],
            ],
        ]);

        $pointers = [];

        foreach ($rows as $row) {
            $eventId = $row['event_id'] ?? null;
            $submissionId = $row['submission_id'] ?? null;

            if (! is_string($eventId) || ! is_string($submissionId)) {
                continue;
            }

            $pointers[] = [
                'event_id' => $eventId,
                'submission_id' => $submissionId,
                'sent_at' => is_string($row['sent_at'] ?? null) ? $row['sent_at'] : '',
            ];
        }

        return $pointers;
    }
}
