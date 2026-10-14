<?php

namespace App\Aws\DynamoDb;

/**
 * OSAAR rejection of a post-evaluation: submitted -> denied. The linked
 * submission is intentionally left at approved (only an approval finishes it),
 * and a denied filing may be re-submitted by the organization. Idempotent:
 * re-denying an already denied post-eval is a no-op; an approved one is refused.
 */
final class DenyPostEval
{
    public function __construct(
        private DynamoDbItems $items,
        private GetPostEval $postEvals,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(string $eventId, string $postEvalId): array
    {
        $postEval = $this->postEvals->require($eventId, $postEvalId);
        $status = $postEval['status'] ?? null;

        if ($status === 'approved') {
            abort(422, 'An approved post-evaluation cannot be denied.');
        }

        if ($status === 'denied') {
            return $postEval;
        }

        $deniedAt = DynamoKeys::now();

        $this->items->patch(
            DynamoKeys::event($eventId),
            DynamoKeys::postEval($postEvalId),
            ['status' => 'denied', 'denied_at' => $deniedAt],
        );

        $postEval['status'] = 'denied';
        $postEval['denied_at'] = $deniedAt;

        return $postEval;
    }
}
