<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

final class WriteSubmission
{
    public function __construct(
        private DynamoDbItems $items,
        private GetEvent $events,
        private GetSubmission $submissions,
        private SignatorySequenceResolver $sequence,
        private OrganizationRecords $organizations,
        private CollaborationRecords $collaborations,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function create(string $organizationId, array $payload): array
    {
        $dependents = $this->resolveDependents($organizationId, $payload);
        $signatoryIds = $this->sequence->signatoryIdsForCollaboration($organizationId, $dependents, $payload);
        $sequence = $this->sequenceKeys($signatoryIds);
        $currentSignatory = $sequence[0];

        $eventId = (string) $payload['event_id'];
        $this->ensureEvent($eventId, $organizationId);

        $sentAt = DynamoKeys::now();
        $submissionId = (string) Str::uuid();

        $item = $this->submissionItem($organizationId, $eventId, $submissionId, $payload, $currentSignatory, $sequence, $sentAt, 'pending', $dependents);
        $this->items->put($item, 'attribute_not_exists(PK)');

        foreach ($dependents as $dependentId) {
            $this->collaborations->put($dependentId, $eventId, $submissionId, $sentAt);
        }

        return $item;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function update(string $organizationId, string $eventId, string $submissionId, array $payload): array
    {
        $this->events->forOrganization($eventId, $organizationId);
        $existing = $this->submissions->require($eventId, $submissionId);
        $status = $existing['status'] ?? null;

        if ($status === 'approved') {
            abort(422, 'Approved submissions cannot be edited.');
        }

        if ($status === 'denied') {
            abort(422, 'Denied submissions cannot be edited.');
        }

        if (! in_array($status, ['pending', 'returned'], true)) {
            abort(422, 'This submission cannot be edited.');
        }

        $dependents = $this->resolveDependents($organizationId, $payload);
        $signatoryIds = $this->sequence->signatoryIdsForCollaboration($organizationId, $dependents, $payload);
        $sequence = $this->sequenceKeys($signatoryIds);
        $existingDesk = $existing['current_signatory'] ?? null;
        $keepDesk = $status === 'returned'
            && is_string($existingDesk)
            && in_array($existingDesk, $sequence, true);
        $currentSignatory = $keepDesk
            ? (string) $existingDesk
            : $sequence[0];
        $sentAt = DynamoKeys::now();

        $item = $this->submissionItem($organizationId, $eventId, $submissionId, $payload, $currentSignatory, $sequence, $sentAt, 'pending', $dependents);
        $this->items->put($item);

        $this->reconcileCollaborators($eventId, $submissionId, $sentAt, $this->existingDependents($existing), $dependents);

        return $item;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<string>
     */
    private function resolveDependents(string $organizationId, array $payload): array
    {
        $requested = data_get($payload, 'collaboration.dependent_organization_ids', []);

        if (! is_array($requested)) {
            $requested = [];
        }

        $dependents = [];

        foreach ($requested as $dependentId) {
            $dependentId = DynamoKeys::strip(is_string($dependentId) ? $dependentId : '', 'ORGANIZATION#');

            if ($dependentId === null || $dependentId === '' || $dependentId === $organizationId) {
                continue;
            }

            $this->organizations->require($dependentId);
            $dependents[$dependentId] = $dependentId;
        }

        return array_values($dependents);
    }

    /**
     * @param  array<string, mixed>  $existing
     * @return list<string>
     */
    private function existingDependents(array $existing): array
    {
        $stored = data_get($existing, 'collaboration.dependent_organization_ids', []);

        if (! is_array($stored)) {
            return [];
        }

        $dependents = [];

        foreach ($stored as $dependentKey) {
            $dependentId = DynamoKeys::strip(is_string($dependentKey) ? $dependentKey : '', 'ORGANIZATION#');

            if ($dependentId !== null && $dependentId !== '') {
                $dependents[$dependentId] = $dependentId;
            }
        }

        return array_values($dependents);
    }

    /**
     * @param  list<string>  $previous
     * @param  list<string>  $current
     */
    private function reconcileCollaborators(string $eventId, string $submissionId, string $sentAt, array $previous, array $current): void
    {
        foreach ($current as $dependentId) {
            if (! in_array($dependentId, $previous, true)) {
                $this->collaborations->put($dependentId, $eventId, $submissionId, $sentAt);
            }
        }

        foreach ($previous as $dependentId) {
            if (! in_array($dependentId, $current, true)) {
                $this->collaborations->remove($dependentId, $eventId, $submissionId);
            }
        }
    }

    /**
     * @param  list<string>  $signatoryIds
     * @return list<string>
     */
    private function sequenceKeys(array $signatoryIds): array
    {
        return array_map(static fn (string $id): string => DynamoKeys::signatory($id), $signatoryIds);
    }

    private function ensureEvent(string $eventId, string $organizationId): void
    {
        $event = $this->events->handle($eventId);

        if ($event !== null && ($event['GSI1PK'] ?? null) !== DynamoKeys::organization($organizationId)) {
            abort(404);
        }

        if ($event !== null) {
            return;
        }

        $sentAt = DynamoKeys::now();
        $key = DynamoKeys::event($eventId);

        $this->items->put([
            'PK' => $key,
            'SK' => $key,
            'sent_at' => $sentAt,
            'GSI1PK' => DynamoKeys::organization($organizationId),
            'GSI1SK' => $sentAt,
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $signatorySequence
     * @param  list<string>  $dependentOrgIds
     * @return array<string, mixed>
     */
    private function submissionItem(
        string $organizationId,
        string $eventId,
        string $submissionId,
        array $payload,
        string $currentSignatory,
        array $signatorySequence,
        string $sentAt,
        string $status,
        array $dependentOrgIds,
    ): array {
        return [
            'PK' => DynamoKeys::event($eventId),
            'SK' => DynamoKeys::submission($submissionId),
            'submission_type' => $payload['submission_type'],
            'sent_at' => $sentAt,
            'status' => $status,
            'current_signatory' => $currentSignatory,
            'signatory_sequence' => $signatorySequence,
            'collaboration' => [
                'dependent_organization_ids' => array_map(
                    static fn (string $id): string => DynamoKeys::organization($id),
                    $dependentOrgIds,
                ),
            ],
            'GSI1PK' => DynamoKeys::organization($organizationId),
            'GSI1SK' => DynamoKeys::submission($submissionId),
            'GSI2PK' => $currentSignatory,
            'GSI2SK' => $sentAt,
            'activity_classification' => $payload['activity_classification'],
            'proponents' => $payload['proponents'],
            'activity_details' => $payload['activity_details'],
            'institutional_alignment' => $payload['institutional_alignment'],
            'detailed_budget_proposal' => $payload['detailed_budget_proposal'],
            'venue_reservation' => $payload['venue_reservation'],
        ];
    }
}
