<?php

namespace Tests\Fakes;

use App\Aws\DynamoDb\ItemMarshaller;
use Aws\DynamoDb\DynamoDbClient;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

final class InMemoryDynamoDb
{
    /**
     * @var array<string, array<string, mixed>>
     */
    private array $table = [];

    public function __construct(private ItemMarshaller $marshaller = new ItemMarshaller) {}

    public static function bind(TestCase $test): self
    {
        $memory = new self;
        $mock = Mockery::mock(DynamoDbClient::class);
        $memory->bindMock($mock);
        $test->swapDynamoDbClient($mock);

        return $memory;
    }

    public function bindMock(MockInterface $mock): void
    {
        $mock->shouldReceive('getItem')->andReturnUsing($this->getItem(...));
        $mock->shouldReceive('putItem')->andReturnUsing($this->putItem(...));
        $mock->shouldReceive('query')->andReturnUsing($this->query(...));
        $mock->shouldReceive('scan')->andReturnUsing($this->scan(...));
        $mock->shouldReceive('updateItem')->andReturnUsing($this->updateItem(...));
        $mock->shouldReceive('deleteItem')->andReturnUsing($this->deleteItem(...));
    }

    /**
     * @param  array<string, mixed>  $item
     */
    public function seed(array $item): void
    {
        $this->table[$this->key((string) $item['PK'], (string) $item['SK'])] = $this->marshaller->marshal($item);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $pk, string $sk): ?array
    {
        $item = $this->table[$this->key($pk, $sk)] ?? null;

        return is_array($item) ? $this->marshaller->unmarshal($item) : null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function all(): array
    {
        return array_map($this->marshaller->unmarshal(...), array_values($this->table));
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{Item?: array<string, mixed>}
     */
    private function getItem(array $args): array
    {
        $pk = $args['Key']['PK']['S'] ?? '';
        $sk = $args['Key']['SK']['S'] ?? '';
        $item = $this->table[$this->key($pk, $sk)] ?? null;

        return is_array($item) ? ['Item' => $item] : [];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{}
     */
    private function putItem(array $args): array
    {
        $item = $args['Item'] ?? [];
        $pk = $item['PK']['S'] ?? '';
        $sk = $item['SK']['S'] ?? '';
        $this->table[$this->key($pk, $sk)] = $item;

        return [];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{Items: list<array<string, mixed>>}
     */
    private function query(array $args): array
    {
        $values = $args['ExpressionAttributeValues'] ?? [];
        $index = $args['IndexName'] ?? null;
        $expression = $args['KeyConditionExpression'] ?? '';
        $matches = [];

        foreach ($this->table as $item) {
            if (is_string($index) && ! $this->matchesIndex($item, $index, $values)) {
                continue;
            }

            if (is_string($index) && str_contains($expression, 'begins_with(GSI1SK')) {
                $prefix = $values[':sk']['S'] ?? '';
                $sortKey = $item['GSI1SK']['S'] ?? '';

                if (! is_string($sortKey) || ! str_starts_with($sortKey, (string) $prefix)) {
                    continue;
                }
            }

            if ($index === null && ! $this->matchesPrimaryQuery($item, $expression, $values)) {
                continue;
            }

            $matches[] = $item;
        }

        $limit = $args['Limit'] ?? null;

        if (is_int($limit)) {
            $matches = array_slice($matches, 0, $limit);
        }

        return ['Items' => array_values($matches)];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{Items: list<array<string, mixed>>}
     */
    private function scan(array $args): array
    {
        $values = $args['ExpressionAttributeValues'] ?? [];
        $expression = $args['FilterExpression'] ?? '';
        $matches = [];

        foreach ($this->table as $item) {
            if ($this->matchesScanFilter($item, $expression, $values)) {
                $matches[] = $item;
            }
        }

        return ['Items' => array_values($matches)];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{}
     */
    private function updateItem(array $args): array
    {
        $pk = $args['Key']['PK']['S'] ?? '';
        $sk = $args['Key']['SK']['S'] ?? '';
        $key = $this->key($pk, $sk);
        $item = $this->table[$key] ?? null;

        if (! is_array($item)) {
            return [];
        }

        $names = $args['ExpressionAttributeNames'] ?? [];
        $values = $args['ExpressionAttributeValues'] ?? [];
        $expression = $args['UpdateExpression'] ?? '';

        if (preg_match('/SET (.+?)(?: REMOVE|$)/', $expression, $setMatch) === 1) {
            foreach (explode(',', $setMatch[1]) as $assignment) {
                [$nameAlias, $valueAlias] = array_map(trim(...), explode('=', $assignment, 2));
                $attribute = $names[$nameAlias] ?? ltrim($nameAlias, '#');
                $item[$attribute] = $values[$valueAlias] ?? ['NULL' => true];
            }
        }

        if (preg_match('/REMOVE (.+)$/', $expression, $removeMatch) === 1) {
            foreach (explode(',', $removeMatch[1]) as $nameAlias) {
                $attribute = $names[trim($nameAlias)] ?? ltrim(trim($nameAlias), '#');
                unset($item[$attribute]);
            }
        }

        $this->table[$key] = $item;

        return [];
    }

    /**
     * @param  array<string, mixed>  $args
     * @return array{}
     */
    private function deleteItem(array $args): array
    {
        $pk = $args['Key']['PK']['S'] ?? '';
        $sk = $args['Key']['SK']['S'] ?? '';
        unset($this->table[$this->key($pk, $sk)]);

        return [];
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, mixed>  $values
     */
    private function matchesIndex(array $item, string $index, array $values): bool
    {
        $attribute = match ($index) {
            'GSI1' => 'GSI1PK',
            'GSI2' => 'GSI2PK',
            'GSI3' => 'GSI3PK',
            'GSI4' => 'GSI4PK',
            default => null,
        };

        if ($attribute === null || ! isset($item[$attribute]['S'])) {
            return false;
        }

        $expected = $values[':org']['S']
            ?? $values[':signatory']['S']
            ?? $values[':role']['S']
            ?? null;

        return $item[$attribute]['S'] === $expected;
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, mixed>  $values
     */
    private function matchesPrimaryQuery(array $item, string $expression, array $values): bool
    {
        $pk = $values[':pk']['S'] ?? null;

        if (! is_string($pk) || ($item['PK']['S'] ?? null) !== $pk) {
            return false;
        }

        if (str_contains($expression, 'begins_with(SK')) {
            $prefix = $values[':sk']['S'] ?? '';

            return str_starts_with((string) ($item['SK']['S'] ?? ''), $prefix);
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, mixed>  $values
     */
    private function matchesScanFilter(array $item, string $expression, array $values): bool
    {
        if (str_contains($expression, 'begins_with(SK')) {
            $prefix = $values[':sk']['S'] ?? '';

            return str_starts_with((string) ($item['SK']['S'] ?? ''), $prefix);
        }

        if (str_contains($expression, 'begins_with(PK')) {
            $prefix = $values[':pk']['S'] ?? '';
            $pk = $item['PK']['S'] ?? null;
            $sk = $item['SK']['S'] ?? null;

            return is_string($pk) && str_starts_with($pk, $prefix) && $pk === $sk;
        }

        return true;
    }

    private function key(string $pk, string $sk): string
    {
        return $pk."\0".$sk;
    }
}
