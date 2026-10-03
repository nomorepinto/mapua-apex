<?php

namespace App\Aws\DynamoDb;

final class ScanSubmissions
{
    public function __construct(
        private DynamoDbItems $items,
        private OrganizationRecords $organizations,
    ) {}

    /**
     * Admin list. Reads each organization's GSI1 partition and keeps rows whose
     * GSI1SK is a submission. Status and activity type are filtered after that.
     *
     * @param  array{status?: string|null, activity_type?: string|null, organization_id?: string|null}  $filters
     * @return list<array<string, mixed>>
     */
    public function handle(array $filters = []): array
    {
        $status = $filters['status'] ?? null;
        $activityType = $filters['activity_type'] ?? null;
        $organizationId = $filters['organization_id'] ?? null;
        $organizations = $this->organizationsById();
        $organizationIds = is_string($organizationId) && $organizationId !== ''
            ? [DynamoKeys::strip($organizationId, 'ORGANIZATION#') ?? $organizationId]
            : array_keys($organizations);

        $items = [];

        foreach ($organizationIds as $id) {
            if (! is_string($id) || $id === '') {
                continue;
            }

            $name = $organizations[$id]['name'] ?? $this->organizations->get($id)['name'] ?? null;

            foreach ($this->submissionsForOrganization($id) as $item) {
                if (is_string($name) && $name !== '') {
                    $item['organization_name'] = $name;
                }

                $items[] = $item;
            }
        }

        return array_values(array_filter($items, function (array $item) use ($status, $activityType): bool {
            if (is_string($status) && $status !== '' && ($item['status'] ?? null) !== $status) {
                return false;
            }

            if (is_string($activityType) && $activityType !== '' && data_get($item, 'activity_classification.activity_type') !== $activityType) {
                return false;
            }

            return true;
        }));
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function organizationsById(): array
    {
        $organizations = [];

        foreach ($this->organizations->list() as $organization) {
            $id = DynamoKeys::strip($organization['PK'] ?? null, 'ORGANIZATION#');

            if (is_string($id) && $id !== '') {
                $organizations[$id] = $organization;
            }
        }

        return $organizations;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function submissionsForOrganization(string $organizationId): array
    {
        return $this->items->query([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :org AND begins_with(GSI1SK, :sk)',
            'ExpressionAttributeValues' => [
                ':org' => ['S' => DynamoKeys::organization($organizationId)],
                ':sk' => ['S' => 'SUBMISSION#'],
            ],
        ]);
    }
}
