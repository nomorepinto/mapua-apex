<?php

namespace App\Aws\DynamoDb;

use Aws\DynamoDb\DynamoDbClient;

final class DynamoDbItems
{
    public function __construct(
        private DynamoDbClient $dynamo,
        private ItemMarshaller $marshaller = new ItemMarshaller,
    ) {}

    public function table(): string
    {
        return (string) config('aws.dynamodb.table');
    }

    /**
     * @param  array<string, mixed>  $params
     * @return list<array<string, mixed>>
     */
    public function query(array $params, bool $allPages = true): array
    {
        $params['TableName'] ??= $this->table();
        $items = [];

        do {
            $result = $this->dynamo->query($params);

            foreach ($result['Items'] ?? [] as $item) {
                if (is_array($item)) {
                    $items[] = $this->marshaller->unmarshal($item);
                }
            }

            $exclusiveStartKey = $result['LastEvaluatedKey'] ?? null;
            $params['ExclusiveStartKey'] = $exclusiveStartKey;
        } while ($allPages && is_array($exclusiveStartKey) && $exclusiveStartKey !== []);

        return $items;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return list<array<string, mixed>>
     */
    public function scan(array $params, int $maxItems = 100): array
    {
        $params['TableName'] ??= $this->table();
        $items = [];

        do {
            $result = $this->dynamo->scan($params);

            foreach ($result['Items'] ?? [] as $item) {
                if (is_array($item)) {
                    $items[] = $this->marshaller->unmarshal($item);
                }

                if (count($items) >= $maxItems) {
                    return $items;
                }
            }

            $exclusiveStartKey = $result['LastEvaluatedKey'] ?? null;
            $params['ExclusiveStartKey'] = $exclusiveStartKey;
        } while (is_array($exclusiveStartKey) && $exclusiveStartKey !== []);

        return $items;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get(string $pk, string $sk): ?array
    {
        $result = $this->dynamo->getItem([
            'TableName' => $this->table(),
            'Key' => $this->marshaller->marshal([
                'PK' => $pk,
                'SK' => $sk,
            ]),
        ]);

        $item = $result['Item'] ?? null;

        return is_array($item) ? $this->marshaller->unmarshal($item) : null;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    public function put(array $item, ?string $conditionExpression = null): void
    {
        $params = [
            'TableName' => $this->table(),
            'Item' => $this->marshaller->marshal($item),
        ];

        if ($conditionExpression !== null) {
            $params['ConditionExpression'] = $conditionExpression;
        }

        $this->dynamo->putItem($params);
    }

    /**
     * @param  array<string, mixed>  $set
     * @param  list<string>  $remove
     */
    public function patch(string $pk, string $sk, array $set = [], array $remove = []): void
    {
        $names = [];
        $values = [];
        $setParts = [];
        $index = 0;

        foreach ($set as $attribute => $value) {
            $nameAlias = '#a'.$index;
            $valueAlias = ':v'.$index;
            $names[$nameAlias] = $attribute;
            $values[$valueAlias] = $this->marshaller->marshalValue($value);
            $setParts[] = $nameAlias.' = '.$valueAlias;
            $index++;
        }

        $removeParts = [];

        foreach ($remove as $attribute) {
            $nameAlias = '#r'.$index;
            $names[$nameAlias] = $attribute;
            $removeParts[] = $nameAlias;
            $index++;
        }

        $expression = '';

        if ($setParts !== []) {
            $expression .= 'SET '.implode(', ', $setParts);
        }

        if ($removeParts !== []) {
            $expression .= ($expression === '' ? '' : ' ').'REMOVE '.implode(', ', $removeParts);
        }

        $params = [
            'TableName' => $this->table(),
            'Key' => $this->marshaller->marshal([
                'PK' => $pk,
                'SK' => $sk,
            ]),
            'UpdateExpression' => $expression,
        ];

        if ($names !== []) {
            $params['ExpressionAttributeNames'] = $names;
        }

        if ($values !== []) {
            $params['ExpressionAttributeValues'] = $values;
        }

        $this->dynamo->updateItem($params);
    }

    public function delete(string $pk, string $sk): void
    {
        $this->dynamo->deleteItem([
            'TableName' => $this->table(),
            'Key' => $this->marshaller->marshal([
                'PK' => $pk,
                'SK' => $sk,
            ]),
        ]);
    }

    public function marshaller(): ItemMarshaller
    {
        return $this->marshaller;
    }
}
