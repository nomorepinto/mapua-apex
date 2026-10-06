<?php

namespace App\Aws\DynamoDb;

final class ApproveSubmission
{
    public function __construct(
        private DynamoDbItems $items,
        private GetSubmission $submissions,
        private SignatorySequenceResolver $sequence,
        private GetEvent $events,
        private NotificationRecords $notifications,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(string $signatoryId, string $eventId, string $submissionId): array
    {
        $submission = $this->submissions->require($eventId, $submissionId);
        SignatoryDesk::requireOpen($submission, $signatoryId);

        $stored = $submission['signatory_sequence'] ?? null;
        $needsBackfill = ! is_array($stored) || $stored === [];

        $sequence = $needsBackfill
            ? $this->resolveSequence($eventId, $submission)
            : array_map(static fn ($id): string => DynamoKeys::signatory((string) $id), array_values($stored));

        $currentIndex = array_search(DynamoKeys::signatory($signatoryId), $sequence, true);

        if ($currentIndex === false) {
            abort(404);
        }

        $nextSignatory = $sequence[$currentIndex + 1] ?? null;
        $now = DynamoKeys::now();
        $fullyApproved = $nextSignatory === null;

        if ($fullyApproved) {
            $set = ['status' => 'approved'];

            if ($needsBackfill) {
                $set['signatory_sequence'] = $sequence;
            }

            $this->items->patch(
                DynamoKeys::event($eventId),
                DynamoKeys::submission($submissionId),
                $set,
                ['GSI2PK', 'GSI2SK'],
            );

            $submission['status'] = 'approved';
            $submission['signatory_sequence'] = $sequence;
            unset($submission['GSI2PK'], $submission['GSI2SK']);

            $this->notifications->create(
                $submissionId,
                $signatoryId,
                'fully approved',
                sentAt: $now,
                submission: $submission,
            );

            return $submission;
        }

        $set = [
            'status' => 'pending',
            'current_signatory' => $nextSignatory,
            'GSI2PK' => $nextSignatory,
            'GSI2SK' => $now,
        ];

        if ($needsBackfill) {
            $set['signatory_sequence'] = $sequence;
        }

        $this->items->patch(DynamoKeys::event($eventId), DynamoKeys::submission($submissionId), $set);

        $submission['status'] = 'pending';
        $submission['current_signatory'] = $nextSignatory;
        $submission['signatory_sequence'] = $sequence;
        $submission['GSI2PK'] = $nextSignatory;
        $submission['GSI2SK'] = $now;

        $this->notifications->create(
            $submissionId,
            $signatoryId,
            'approved',
            sentAt: $now,
            submission: $submission,
        );

        return $submission;
    }

    /**
     * Legacy items predate the stored sequence; resolve it once and persist on this approve.
     *
     * @param  array<string, mixed>  $submission
     * @return list<string>
     */
    private function resolveSequence(string $eventId, array $submission): array
    {
        $event = $this->events->handle($eventId);
        $organizationId = DynamoKeys::strip($event['GSI1PK'] ?? null, 'ORGANIZATION#');

        if ($event === null || $organizationId === null) {
            abort(404);
        }

        return array_map(
            static fn (string $id): string => DynamoKeys::signatory($id),
            $this->sequence->signatoryIds($organizationId, $submission),
        );
    }
}
