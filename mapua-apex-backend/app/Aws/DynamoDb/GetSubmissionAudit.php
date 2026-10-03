<?php

namespace App\Aws\DynamoDb;

final class GetSubmissionAudit
{
    public function __construct(
        private GetSubmission $submissions,
        private ListSubmissionNotifications $notifications,
        private OrganizationRecords $organizations,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(string $eventId, string $submissionId): array
    {
        $submission = $this->submissions->require($eventId, $submissionId);
        $organizationId = DynamoKeys::strip($submission['GSI1PK'] ?? null, 'ORGANIZATION#');
        $name = is_string($organizationId)
            ? ($this->organizations->get($organizationId)['name'] ?? null)
            : null;

        if (is_string($name) && $name !== '') {
            $submission['organization_name'] = $name;
        }

        $submission['notifications'] = $this->notifications->handle($submissionId);

        return $submission;
    }
}
