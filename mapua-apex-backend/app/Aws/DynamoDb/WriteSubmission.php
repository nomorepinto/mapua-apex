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
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function create(string $organizationId, array $payload): array
    {
        $signatoryIds = $this->sequence->signatoryIds($organizationId, $payload);
        $currentSignatory = DynamoKeys::signatory($signatoryIds[0]);

        $eventId = (string) $payload['event_id'];
        $this->ensureEvent($eventId, $organizationId);

        $sentAt = DynamoKeys::now();
        $submissionId = (string) Str::uuid();

        $item = $this->submissionItem($organizationId, $eventId, $submissionId, $payload, $currentSignatory, $sentAt, 'pending');
        $this->items->put($item, 'attribute_not_exists(PK)');

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

        $signatoryIds = $this->sequence->signatoryIds($organizationId, $payload);
        $keepDesk = $status === 'returned' && is_string($existing['current_signatory'] ?? null);
        $currentSignatory = $keepDesk
            ? (string) $existing['current_signatory']
            : DynamoKeys::signatory($signatoryIds[0]);
        $sentAt = DynamoKeys::now();

        $item = $this->submissionItem($organizationId, $eventId, $submissionId, $payload, $currentSignatory, $sentAt, 'pending');
        $this->items->put($item);

        return $item;
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
     * @return array<string, mixed>
     */
    private function submissionItem(
        string $organizationId,
        string $eventId,
        string $submissionId,
        array $payload,
        string $currentSignatory,
        string $sentAt,
        string $status,
    ): array {
        return [
            'PK' => DynamoKeys::event($eventId),
            'SK' => DynamoKeys::submission($submissionId),
            'submission_type' => $payload['submission_type'],
            'sent_at' => $sentAt,
            'status' => $status,
            'current_signatory' => $currentSignatory,
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
