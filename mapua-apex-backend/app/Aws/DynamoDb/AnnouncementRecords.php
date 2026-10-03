<?php

namespace App\Aws\DynamoDb;

final class AnnouncementRecords
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function list(): array
    {
        $items = $this->items->query([
            'KeyConditionExpression' => 'PK = :pk',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::announcement()],
            ],
            'ScanIndexForward' => false,
        ]);

        usort(
            $items,
            fn (array $left, array $right): int => strcmp((string) ($right['SK'] ?? ''), (string) ($left['SK'] ?? '')),
        );

        return $items;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get(string $sentAt): ?array
    {
        return $this->items->get(DynamoKeys::announcement(), $sentAt);
    }

    /**
     * @return array<string, mixed>
     */
    public function create(string $content): array
    {
        $item = [
            'PK' => DynamoKeys::announcement(),
            'SK' => DynamoKeys::now(),
            'content' => $content,
        ];

        $this->items->put($item);

        return $item;
    }

    /**
     * @return array<string, mixed>
     */
    public function update(string $sentAt, string $content): array
    {
        if ($this->get($sentAt) === null) {
            abort(404);
        }

        $item = [
            'PK' => DynamoKeys::announcement(),
            'SK' => $sentAt,
            'content' => $content,
        ];

        $this->items->put($item);

        return $item;
    }

    public function delete(string $sentAt): void
    {
        if ($this->get($sentAt) === null) {
            abort(404);
        }

        $this->items->delete(DynamoKeys::announcement(), $sentAt);
    }
}
