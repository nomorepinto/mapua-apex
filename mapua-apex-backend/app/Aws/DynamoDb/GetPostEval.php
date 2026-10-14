<?php

namespace App\Aws\DynamoDb;

final class GetPostEval
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return array<string, mixed>|null
     */
    public function handle(string $eventId, string $postEvalId): ?array
    {
        return $this->items->get(DynamoKeys::event($eventId), DynamoKeys::postEval($postEvalId));
    }

    /**
     * @return array<string, mixed>
     */
    public function require(string $eventId, string $postEvalId): array
    {
        $postEval = $this->handle($eventId, $postEvalId);

        if ($postEval === null) {
            abort(404);
        }

        return $postEval;
    }

    /**
     * Require a post-eval and assert it belongs to the given organization, so a
     * student can never read another org's filing (mirrors GetEvent::forOrganization).
     *
     * @return array<string, mixed>
     */
    public function forOrganization(string $eventId, string $postEvalId, string $organizationId): array
    {
        $postEval = $this->require($eventId, $postEvalId);

        if (($postEval['GSI1PK'] ?? null) !== DynamoKeys::organization($organizationId)) {
            abort(404);
        }

        return $postEval;
    }
}
