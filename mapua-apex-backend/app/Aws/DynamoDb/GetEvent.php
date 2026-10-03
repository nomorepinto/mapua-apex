<?php

namespace App\Aws\DynamoDb;

final class GetEvent
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return array<string, mixed>|null
     */
    public function handle(string $eventId): ?array
    {
        $key = DynamoKeys::event($eventId);

        return $this->items->get($key, $key);
    }

    /**
     * @return array<string, mixed>
     */
    public function forOrganization(string $eventId, string $organizationId): array
    {
        $event = $this->handle($eventId);

        if ($event === null || ($event['GSI1PK'] ?? null) !== DynamoKeys::organization($organizationId)) {
            abort(404);
        }

        return $event;
    }
}
