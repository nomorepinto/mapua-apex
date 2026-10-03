<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

final class OrganizationRecords
{
    /**
     * @var list<string>
     */
    private const DESK_ORDER = ['adviser', 'dean', 'osaar', 'cdm', 'admin'];

    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function list(): array
    {
        return $this->items->scan([
            'FilterExpression' => 'begins_with(PK, :pk) AND PK = SK',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => 'ORGANIZATION#'],
            ],
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get(string $organizationId): ?array
    {
        $key = DynamoKeys::organization($organizationId);

        return $this->items->get($key, $key);
    }

    /**
     * @return array<string, mixed>
     */
    public function require(string $organizationId): array
    {
        $item = $this->get($organizationId);

        if ($item === null) {
            abort(422, 'The selected organization does not exist.');
        }

        return $item;
    }

    /**
     * @param  list<array<string, mixed>>  $signatories
     * @return array<string, mixed>
     */
    public function create(string $name, array $signatories = [], bool $isHigherCouncil = false): array
    {
        $id = (string) Str::uuid();
        $key = DynamoKeys::organization($id);
        $item = [
            'PK' => $key,
            'SK' => $key,
            'name' => $name,
            'signatories' => $this->orderedDesks($this->desks(['signatories' => $signatories])),
            'is_higher_council' => $isHigherCouncil,
        ];

        $this->items->put($item);

        return $item;
    }

    /**
     * @param  list<array<string, mixed>>  $signatories
     * @return array<string, mixed>
     */
    public function update(
        string $organizationId,
        string $name,
        array $signatories,
        ?bool $isHigherCouncil = null,
    ): array {
        $existing = $this->get($organizationId);

        if ($existing === null) {
            abort(404);
        }

        $key = DynamoKeys::organization($organizationId);
        $item = [
            'PK' => $key,
            'SK' => $key,
            'name' => $name,
            'signatories' => $this->orderedDesks($this->desks(['signatories' => $signatories])),
            'is_higher_council' => $isHigherCouncil ?? (($existing['is_higher_council'] ?? false) === true),
        ];

        $this->items->put($item);

        return $item;
    }

    public function assign(string $organizationId, string $role, string $signatoryId): void
    {
        $organization = $this->require($organizationId);
        $role = Str::lower($role);
        $signatoryId = DynamoKeys::strip($signatoryId, 'SIGNATORY#') ?? $signatoryId;

        $desks = [];

        foreach ($this->desks($organization) as $desk) {
            if ($desk['role'] === $role || $desk['signatory_id'] === $signatoryId) {
                continue;
            }

            $desks[] = $desk;
        }

        $desks[] = [
            'role' => $role,
            'signatory_id' => $signatoryId,
        ];

        $this->saveDesks($organizationId, $desks);
    }

    public function detach(string $organizationId, string $signatoryId): void
    {
        $organization = $this->get($organizationId);

        if ($organization === null) {
            return;
        }

        $signatoryId = DynamoKeys::strip($signatoryId, 'SIGNATORY#') ?? $signatoryId;
        $desks = [];

        foreach ($this->desks($organization) as $desk) {
            if ($desk['signatory_id'] === $signatoryId) {
                continue;
            }

            $desks[] = $desk;
        }

        $this->saveDesks($organizationId, $desks);
    }

    /**
     * @param  array<string, mixed>  $organization
     * @return list<array{role: string, signatory_id: string}>
     */
    public function desks(array $organization): array
    {
        $entries = $organization['signatories'] ?? [];

        if (! is_array($entries)) {
            return [];
        }

        $desks = [];

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $role = $entry['role'] ?? null;
            $signatoryId = DynamoKeys::strip($entry['signatory_id'] ?? null, 'SIGNATORY#');

            if (! is_string($role) || $role === '' || $signatoryId === null) {
                continue;
            }

            $desks[] = [
                'role' => Str::lower($role),
                'signatory_id' => $signatoryId,
            ];
        }

        return $desks;
    }

    /**
     * @param  list<array{role: string, signatory_id: string}>  $desks
     */
    private function saveDesks(string $organizationId, array $desks): void
    {
        $key = DynamoKeys::organization($organizationId);
        $this->items->patch($key, $key, [
            'signatories' => $this->orderedDesks($desks),
        ]);
    }

    /**
     * @param  list<array{role: string, signatory_id: string}>  $desks
     * @return list<array{role: string, signatory_id: string}>
     */
    private function orderedDesks(array $desks): array
    {
        usort($desks, function (array $left, array $right): int {
            $leftRank = array_search($left['role'], self::DESK_ORDER, true);
            $rightRank = array_search($right['role'], self::DESK_ORDER, true);
            $leftRank = $leftRank === false ? 99 : $leftRank;
            $rightRank = $rightRank === false ? 99 : $rightRank;

            if ($leftRank === $rightRank) {
                return $left['signatory_id'] <=> $right['signatory_id'];
            }

            return $leftRank <=> $rightRank;
        });

        return array_values($desks);
    }
}
