<?php

namespace App\Aws\DynamoDb;

final class ListOrgSubmissions
{
    public const EVENT_LIMIT = 25;

    public function __construct(private DynamoDbItems $items) {}

    /**
     * List submissions for an organization by querying GSI1 events, then each event's submissions.
     *
     * Caps events at EVENT_LIMIT. A submissions-by-org GSI is the hot-path fix if this grows.
     *
     * @return list<array<string, mixed>>
     */
    public function handle(string $organizationId, int $eventLimit = self::EVENT_LIMIT): array
    {
        $submissions = [];
        $seenEvents = [];

        foreach ($this->eventsForOrganization($organizationId, $eventLimit) as $event) {
            $eventPk = $event['PK'] ?? null;

            if (! is_string($eventPk) || ! str_starts_with($eventPk, 'EVENT#')) {
                continue;
            }

            if (isset($seenEvents[$eventPk])) {
                continue;
            }

            $seenEvents[$eventPk] = true;

            foreach ($this->submissionsForEvent($eventPk) as $item) {
                $submissions[] = $item;
            }
        }

        return $submissions;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function eventsForOrganization(string $organizationId, int $eventLimit = self::EVENT_LIMIT): array
    {
        return $this->items->query([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :org',
            'ExpressionAttributeValues' => [
                ':org' => ['S' => DynamoKeys::organization($organizationId)],
            ],
            'Limit' => $eventLimit,
        ], allPages: false);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function submissionsForEvent(string $eventPk): array
    {
        return $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => $eventPk],
                ':sk' => ['S' => 'SUBMISSION#'],
            ],
        ]);
    }
}
