<?php

namespace App\Aws\DynamoDb;

final class DenySubmission
{
    public function __construct(
        private DynamoDbItems $items,
        private GetSubmission $submissions,
        private NotificationRecords $notifications,
    ) {}

    /**
     * Final rejection. Drops GSI2 so the desk queue no longer lists it. Students cannot edit.
     *
     * @return array<string, mixed>
     */
    public function handle(string $signatoryId, string $eventId, string $submissionId, string $comment): array
    {
        $submission = $this->submissions->require($eventId, $submissionId);
        SignatoryDesk::requireOpen($submission, $signatoryId);

        $this->notifications->create($submissionId, $signatoryId, 'denied', $comment);

        $this->items->patch(
            DynamoKeys::event($eventId),
            DynamoKeys::submission($submissionId),
            ['status' => 'denied'],
            ['GSI2PK', 'GSI2SK'],
        );

        $submission['status'] = 'denied';
        unset($submission['GSI2PK'], $submission['GSI2SK']);

        return $submission;
    }
}
