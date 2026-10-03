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

        $event = $this->events->handle($eventId);
        $organizationId = DynamoKeys::strip($event['GSI1PK'] ?? null, 'ORGANIZATION#');

        if ($event === null || $organizationId === null) {
            abort(404);
        }

        $sequence = $this->sequence->signatoryIds($organizationId, $submission);
        $currentIndex = array_search($signatoryId, $sequence, true);

        if ($currentIndex === false) {
            abort(404);
        }

        $nextId = $sequence[$currentIndex + 1] ?? null;
        $now = DynamoKeys::now();
        $fullyApproved = $nextId === null;

        $this->notifications->create(
            $submissionId,
            $signatoryId,
            $fullyApproved ? 'fully approved' : 'approved',
            sentAt: $now,
        );

        if ($fullyApproved) {
            $this->items->patch(
                DynamoKeys::event($eventId),
                DynamoKeys::submission($submissionId),
                ['status' => 'approved'],
                ['GSI2PK', 'GSI2SK'],
            );

            $submission['status'] = 'approved';
            unset($submission['GSI2PK'], $submission['GSI2SK']);

            return $submission;
        }

        $nextSignatory = DynamoKeys::signatory($nextId);
        $this->items->patch(DynamoKeys::event($eventId), DynamoKeys::submission($submissionId), [
            'status' => 'pending',
            'current_signatory' => $nextSignatory,
            'GSI2PK' => $nextSignatory,
            'GSI2SK' => $now,
        ]);

        $submission['status'] = 'pending';
        $submission['current_signatory'] = $nextSignatory;
        $submission['GSI2PK'] = $nextSignatory;
        $submission['GSI2SK'] = $now;

        return $submission;
    }
}
