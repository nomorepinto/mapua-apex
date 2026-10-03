<?php

namespace App\Aws\DynamoDb;

final class ListOrgDeadlines
{
    public function __construct(
        private DynamoDbItems $items,
        private ListOrgSubmissions $orgEvents,
    ) {}

    /**
     * Upcoming deadlines for an org's events.
     *
     * There is no PENDING sparse GSI on deadline items yet, so this queries each event
     * (capped like the submissions list) and filters `deadline` in application code.
     *
     * @return list<array<string, mixed>>
     */
    public function handle(string $organizationId): array
    {
        $now = DynamoKeys::now();
        $deadlines = [];

        foreach ($this->orgEvents->eventsForOrganization($organizationId) as $event) {
            $eventPk = $event['PK'] ?? null;

            if (! is_string($eventPk) || ! str_starts_with($eventPk, 'EVENT#')) {
                continue;
            }

            $items = $this->items->query([
                'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
                'ExpressionAttributeValues' => [
                    ':pk' => ['S' => $eventPk],
                    ':sk' => ['S' => 'DEADLINE#'],
                ],
            ]);

            foreach ($items as $item) {
                $deadline = $item['deadline'] ?? null;

                if (is_string($deadline) && $deadline >= $now) {
                    $deadlines[] = $item;
                }
            }
        }

        usort($deadlines, fn (array $left, array $right): int => strcmp((string) ($left['deadline'] ?? ''), (string) ($right['deadline'] ?? '')));

        return $deadlines;
    }
}
