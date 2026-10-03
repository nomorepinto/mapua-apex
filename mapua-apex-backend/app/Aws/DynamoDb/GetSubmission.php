<?php

namespace App\Aws\DynamoDb;

final class GetSubmission
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return array<string, mixed>|null
     */
    public function handle(string $eventId, string $submissionId): ?array
    {
        return $this->items->get(DynamoKeys::event($eventId), DynamoKeys::submission($submissionId));
    }

    /**
     * @return array<string, mixed>
     */
    public function require(string $eventId, string $submissionId): array
    {
        $submission = $this->handle($eventId, $submissionId);

        if ($submission === null) {
            abort(404);
        }

        return $submission;
    }
}
