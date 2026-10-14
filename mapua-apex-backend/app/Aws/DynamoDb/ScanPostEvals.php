<?php

namespace App\Aws\DynamoDb;

/**
 * OSAAR review queue. Reads each organization's GSI1 partition and keeps rows
 * whose GSI1SK is a post-evaluation, then applies the optional status filter.
 * Mirrors ScanSubmissions so the cross-org fan-out stays consistent.
 */
final class ScanPostEvals
{
    public function __construct(
        private DynamoDbItems $items,
        private OrganizationRecords $organizations,
    ) {}

    /**
     * @param  array{status?: string|null, organization_id?: string|null}  $filters
     * @return list<array<string, mixed>>
     */
    public function handle(array $filters = []): array
    {
        $status = $filters['status'] ?? null;
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

            foreach ($this->postEvalsForOrganization($id) as $item) {
                if (is_string($name) && $name !== '') {
                    $item['organization_name'] = $name;
                }

                $items[] = $item;
            }
        }

        return array_values(array_filter($items, static function (array $item) use ($status): bool {
            return ! (is_string($status) && $status !== '' && ($item['status'] ?? null) !== $status);
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
    private function postEvalsForOrganization(string $organizationId): array
    {
        return $this->items->query([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :org AND begins_with(GSI1SK, :sk)',
            'ExpressionAttributeValues' => [
                ':org' => ['S' => DynamoKeys::organization($organizationId)],
                ':sk' => ['S' => 'POSTEVAL#'],
            ],
        ]);
    }
}
