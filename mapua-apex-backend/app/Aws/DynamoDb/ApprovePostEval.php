<?php

namespace App\Aws\DynamoDb;

/**
 * OSAAR approval of a post-evaluation. Terminal for the post-eval
 * (submitted -> approved) and the trigger that closes out the linked event:
 * the submission moves approved -> finished.
 *
 * The evaluation window is deliberately NOT re-checked here — approval may
 * happen after the 3-day filing window closes. Both transitions are idempotent:
 * re-approving an approved post-eval (or finishing an already finished
 * submission) is a safe no-op.
 */
final class ApprovePostEval
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

        if (($postEval['status'] ?? null) === 'denied') {
            abort(422, 'A denied post-evaluation cannot be approved.');
        }

        $approvedAt = DynamoKeys::now();

        if (($postEval['status'] ?? null) !== 'approved') {
            $this->items->patch(
                DynamoKeys::event($eventId),
                DynamoKeys::postEval($postEvalId),
                ['status' => 'approved', 'approved_at' => $approvedAt],
            );

            $postEval['status'] = 'approved';
            $postEval['approved_at'] = $approvedAt;
        }

        $submissionId = $postEval['submission_id'] ?? null;

        if (is_string($submissionId) && $submissionId !== '') {
            $this->finishSubmission($eventId, $submissionId, $approvedAt);
        }

        return $postEval;
    }

    /**
     * approved -> finished on the linked submission; any other state is left
     * untouched so the call is idempotent and never clobbers a non-approved paper.
     */
    private function finishSubmission(string $eventId, string $submissionId, string $finishedAt): void
    {
        $pk = DynamoKeys::event($eventId);
        $sk = DynamoKeys::submission($submissionId);
        $submission = $this->items->get($pk, $sk);

        if ($submission === null || ($submission['status'] ?? null) !== 'approved') {
            return;
        }

        $this->items->patch($pk, $sk, ['status' => 'finished', 'finished_at' => $finishedAt]);
    }
}
