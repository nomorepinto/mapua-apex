<?php

namespace App\Aws\DynamoDb;

/**
 * List submissions a dependent organization can see through its collaboration
 * pointers. Each pointer resolves to the single stored master submission, which
 * is tagged `role = dependent` so the client renders it read-only.
 */
final class ListCollaborationSubmissions
{
    public function __construct(
        private CollaborationRecords $collaborations,
        private GetSubmission $submissions,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function handle(string $organizationId): array
    {
        $items = [];

        foreach ($this->collaborations->listForOrganization($organizationId) as $pointer) {
            $submission = $this->submissions->handle($pointer['event_id'], $pointer['submission_id']);

            if ($submission === null) {
                continue;
            }

            $submission['role'] = 'dependent';
            $items[] = $submission;
        }

        return $items;
    }
}
