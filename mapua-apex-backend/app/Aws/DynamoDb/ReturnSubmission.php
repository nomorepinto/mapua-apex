<?php

namespace App\Aws\DynamoDb;

final class ReturnSubmission
{
    public function __construct(
        private DynamoDbItems $items,
        private GetSubmission $submissions,
        private NotificationRecords $notifications,
    ) {}

    /**
     * Send the paper back for revision. GSI2 stays so the same desk still sees it.
     *
     * @return array<string, mixed>
     */
    public function handle(string $signatoryId, string $eventId, string $submissionId, string $comment): array
    {
        $submission = $this->submissions->require($eventId, $submissionId);
        SignatoryDesk::requireOpen($submission, $signatoryId);

        $this->notifications->create($submissionId, $signatoryId, 'returned', $comment);

        $this->items->patch(
            DynamoKeys::event($eventId),
            DynamoKeys::submission($submissionId),
            ['status' => 'returned'],
        );

        $submission['status'] = 'returned';

        return $submission;
    }
}
