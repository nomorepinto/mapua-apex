<?php

namespace App\Aws\DynamoDb;

final class ReturnSubmission
{
    public function __construct(
        private DynamoDbItems $items,
        private GetSubmission $submissions,
        private NotificationRecords $notifications,
        private BookingRecords $bookings,
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

        // Release the held slots while the paper is being revised; a resubmit
        // re-plans fresh bookings.
        $bookingRefs = is_array($submission['booking_refs'] ?? null) ? $submission['booking_refs'] : [];
        $this->bookings->releaseRefs($bookingRefs);

        $this->items->patch(
            DynamoKeys::event($eventId),
            DynamoKeys::submission($submissionId),
            ['status' => 'returned'],
            ['booking_refs'],
        );

        $submission['status'] = 'returned';
        unset($submission['booking_refs']);

        $this->notifications->create($submissionId, $signatoryId, 'returned', $comment, submission: $submission);

        return $submission;
    }
}
