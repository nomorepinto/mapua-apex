<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

final class CampusRecords
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function list(): array
    {
        return $this->items->scan([
            'FilterExpression' => 'begins_with(PK, :pk) AND PK = SK',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => 'CAMPUS#'],
            ],
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get(string $campusId): ?array
    {
        $key = DynamoKeys::campus($campusId);

        return $this->items->get($key, $key);
    }

    /**
     * @return array<string, mixed>
     */
    public function require(string $campusId): array
    {
        $item = $this->get($campusId);

        if ($item === null) {
            abort(404, 'The selected campus does not exist.');
        }

        return $item;
    }

    /**
     * @return array<string, mixed>
     */
    public function create(string $name, ?array $classroomPrefixes = null, ?int $classroomDigits = null): array
    {
        return $this->write((string) Str::uuid(), $name, $classroomPrefixes, $classroomDigits);
    }

    /**
     * @return array<string, mixed>
     */
    public function update(string $campusId, string $name, ?array $classroomPrefixes = null, ?int $classroomDigits = null): array
    {
        if ($this->get($campusId) === null) {
            abort(404);
        }

        return $this->write($campusId, $name, $classroomPrefixes, $classroomDigits);
    }

    /**
     * Permanently remove a campus, refusing when it still owns reservables that
     * would be left dangling.
     */
    public function delete(string $campusId): void
    {
        $id = DynamoKeys::strip($campusId, 'CAMPUS#') ?? $campusId;
        $key = DynamoKeys::campus($id);

        if ($this->items->get($key, $key) === null) {
            abort(404);
        }

        if ($this->hasReservables($key)) {
            abort(409, 'This campus still has rooms or equipment and cannot be deleted.');
        }

        $this->items->delete($key, $key);
    }

    private function hasReservables(string $campusKey): bool
    {
        return $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => $campusKey],
                ':sk' => ['S' => 'RESERVABLE#'],
            ],
            'Limit' => 1,
        ], allPages: false) !== [];
    }

    /**
     * Persist one campus. The classroom naming format is optional: the prefix
     * list and digit count are stored together only when both are supplied, so a
     * campus without a rule keeps no format attributes.
     *
     * @return array<string, mixed>
     */
    private function write(string $id, string $name, ?array $classroomPrefixes = null, ?int $classroomDigits = null): array
    {
        $key = DynamoKeys::campus($id);
        $item = [
            'PK' => $key,
            'SK' => $key,
            'name' => $name,
        ];

        $prefixes = CampusClassroomNaming::normalizePrefixes($classroomPrefixes ?? []);

        if ($prefixes !== [] && $classroomDigits !== null) {
            $item['classroom_name_prefixes'] = $prefixes;
            $item['classroom_name_digits'] = $classroomDigits;
        }

        $this->items->put($item);

        return $item;
    }
}
