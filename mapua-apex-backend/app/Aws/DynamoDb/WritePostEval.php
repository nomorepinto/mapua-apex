<?php

namespace App\Aws\DynamoDb;

use App\Support\Arcus\EventWindow;
use Illuminate\Support\Str;

/**
 * Files a post-evaluation for a passed, still-in-window event and freezes the
 * Section 3 participation snapshot onto the item.
 *
 * Fool-proof and stateless: the 3-day evaluation window is recomputed here from
 * the stored submission, so a stale or replayed call outside the window is
 * rejected rather than trusted. Structural validation (summary length, per-item
 * amount caps) is enforced upstream by StorePostEvalRequest; this class owns the
 * domain gates: ownership, terminal-approved state, open window, and one active
 * post-eval per event.
 */
final class WritePostEval
{
    public function __construct(
        private DynamoDbItems $items,
        private GetSubmission $submissions,
        private AggregateEventParticipants $participants,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function create(string $organizationId, array $payload): array
    {
        $eventId = (string) ($payload['event_id'] ?? '');
        $submissionId = (string) ($payload['submission_id'] ?? '');
        $submission = $this->submissions->require($eventId, $submissionId);

        $owner = DynamoKeys::strip($submission['GSI1PK'] ?? null, 'ORGANIZATION#');

        if ($owner !== $organizationId) {
            abort(404);
        }

        if (! in_array($submission['status'] ?? null, ['approved', 'finished'], true)) {
            abort(422, 'A post-evaluation can only be filed for an approved event.');
        }

        if (! EventWindow::isOpenNow($submission, EventWindow::EVALUATION)) {
            abort(422, 'The post-evaluation window is closed for this event.');
        }

        if ($this->hasActivePostEval($eventId)) {
            abort(409, 'A post-evaluation has already been filed for this event.');
        }

        $postEvalId = (string) Str::uuid();
        $submittedAt = DynamoKeys::now();

        $item = [
            'PK' => DynamoKeys::event($eventId),
            'SK' => DynamoKeys::postEval($postEvalId),
            'entity_type' => 'posteval',
            'GSI1PK' => DynamoKeys::organization($organizationId),
            'GSI1SK' => DynamoKeys::postEval($postEvalId),
            'organization_id' => $organizationId,
            'event_id' => $eventId,
            'submission_id' => $submissionId,
            'status' => 'submitted',
            'submitted_at' => $submittedAt,
            'event_title' => (string) data_get($submission, 'activity_details.title_and_nature', ''),
            'section_summary' => $payload['section_summary'],
            'financial_report' => $payload['financial_report'],
            'participation_snapshot' => $this->participants->handle($eventId),
        ];

        $this->items->put($item, 'attribute_not_exists(PK)');

        return $item;
    }

    /**
     * True when the event already has a submitted/approved post-eval. A denied
     * filing does not block re-submission.
     */
    private function hasActivePostEval(string $eventId): bool
    {
        $existing = $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::event($eventId)],
                ':sk' => ['S' => 'POSTEVAL#'],
            ],
        ]);

        foreach ($existing as $postEval) {
            if (in_array($postEval['status'] ?? null, ['submitted', 'approved'], true)) {
                return true;
            }
        }

        return false;
    }
}
