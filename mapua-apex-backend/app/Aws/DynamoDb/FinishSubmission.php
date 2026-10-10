<?php

namespace App\Aws\DynamoDb;

use App\Support\Arcus\EventWindow;

/**
 * Terminal transition driven by the arcus-evaluation system when a
 * post-evaluation is completed: approved -> finished.
 *
 * Fool-proof and stateless: the post-evaluation window is recomputed here from
 * the stored date_of_event, so a stale or replayed call outside the window is
 * rejected rather than trusted. Re-finishing an already finished submission is
 * an idempotent no-op.
 */
final class FinishSubmission
{
    public function __construct(
        private DynamoDbItems $items,
        private GetSubmission $submissions,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(string $eventId, string $submissionId, ?string $organizationId = null): array
    {
        $submission = $this->submissions->require($eventId, $submissionId);

        if (is_string($organizationId) && $organizationId !== '') {
            $owner = DynamoKeys::strip($submission['GSI1PK'] ?? null, 'ORGANIZATION#');

            if ($owner !== $organizationId) {
                abort(404);
            }
        }

        $status = $submission['status'] ?? null;

        if ($status === 'finished') {
            return $submission;
        }

        if ($status !== 'approved') {
            abort(422, 'Only an approved submission can be finished.');
        }

        if (! EventWindow::isOpenNow($submission, EventWindow::EVALUATION)) {
            abort(422, 'The post-evaluation window is not open for this event.');
        }

        $finishedAt = DynamoKeys::now();

        $this->items->patch(
            DynamoKeys::event($eventId),
            DynamoKeys::submission($submissionId),
            ['status' => 'finished', 'finished_at' => $finishedAt],
        );

        $submission['status'] = 'finished';
        $submission['finished_at'] = $finishedAt;

        return $submission;
    }
}
