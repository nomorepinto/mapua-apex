<?php

namespace App\Logging;

use App\Aws\DynamoDb\ItemMarshaller;
use App\Aws\AwsClientFactory;
use Aws\DynamoDb\DynamoDbClient;

/**
 * DynamoDB client wrapper for the two append-only log tables.
 * Intentionally separate from DynamoDbItems (main app table) so
 * misconfiguration cannot mix log data with application data.
 */
final class LogTableItems
{
    private readonly DynamoDbClient $client;

    private readonly ItemMarshaller $marshaller;

    public function __construct(AwsClientFactory $factory)
    {
        $this->client     = new DynamoDbClient($factory->clientOptions('dynamodb'));
        $this->marshaller = new ItemMarshaller;
    }

    public function sessionTable(): string
    {
        $table = (string) config('aws.dynamodb.log_session_table', '');

        return $table !== '' ? $table : (string) config('aws.dynamodb.table', '');
    }

    public function activityTable(): string
    {
        $table = (string) config('aws.dynamodb.log_activity_table', '');

        return $table !== '' ? $table : (string) config('aws.dynamodb.table', '');
    }

    /**
     * Put an item unconditionally.
     *
     * @param  array<string, mixed>  $item
     */
    public function put(string $table, array $item): void
    {
        $this->client->putItem([
            'TableName' => $table,
            'Item'      => $this->marshaller->marshal($item),
        ]);
    }

    /**
     * Put an item with a condition expression (used for conditional create).
     *
     * @param  array<string, mixed>  $item
     */
    public function putConditional(string $table, array $item, string $conditionExpression): bool
    {
        try {
            $this->client->putItem([
                'TableName'           => $table,
                'Item'                => $this->marshaller->marshal($item),
                'ConditionExpression' => $conditionExpression,
            ]);

            return true;
        } catch (\Aws\DynamoDb\Exception\DynamoDbException $e) {
            if ($e->getAwsErrorCode() === 'ConditionalCheckFailedException') {
                return false;
            }
            throw $e;
        }
    }

    /**
     * Consistent GetItem — returns null if not found.
     *
     * @return array<string, mixed>|null
     */
    public function get(string $table, string $pk, string $sk): ?array
    {
        $result = $this->client->getItem([
            'TableName'      => $table,
            'Key'            => $this->marshaller->marshal(['PK' => $pk, 'SK' => $sk]),
            'ConsistentRead' => true,
        ]);

        $item = $result['Item'] ?? null;

        return is_array($item) ? $this->marshaller->unmarshal($item) : null;
    }

    /**
     * Update specific attributes on an existing item.
     *
     * @param  array<string, mixed>  $set
     * @param  list<string>          $remove
     */
    public function patch(string $table, string $pk, string $sk, array $set = [], array $remove = []): void
    {
        $names    = [];
        $values   = [];
        $setParts = [];
        $index    = 0;

        foreach ($set as $attribute => $value) {
            $nameAlias  = '#a'.$index;
            $valueAlias = ':v'.$index;
            $names[$nameAlias]  = $attribute;
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
            'TableName'       => $table,
            'Key'             => $this->marshaller->marshal(['PK' => $pk, 'SK' => $sk]),
            'UpdateExpression' => $expression,
        ];

        if ($names !== []) {
            $params['ExpressionAttributeNames'] = $names;
        }

        if ($values !== []) {
            $params['ExpressionAttributeValues'] = $values;
        }

        $this->client->updateItem($params);
    }

    /**
     * Query a GSI, returning unmarshalled items. Supports cursor-based pagination.
     *
     * @param  array<string, mixed>       $params
     * @param  array<string, mixed>|null  $exclusiveStartKey
     * @return array{items: list<array<string, mixed>>, lastEvaluatedKey: array<string, mixed>|null}
     */
    public function query(string $table, array $params, ?array $exclusiveStartKey = null, int $limit = 50): array
    {
        $params['TableName'] = $table;
        $params['Limit']     = $limit;

        if ($exclusiveStartKey !== null) {
            $params['ExclusiveStartKey'] = $this->marshaller->marshal($exclusiveStartKey);
        }

        $result = $this->client->query($params);

        $items = [];

        foreach ($result['Items'] ?? [] as $item) {
            if (is_array($item)) {
                $items[] = $this->marshaller->unmarshal($item);
            }
        }

        $lek = $result['LastEvaluatedKey'] ?? null;
        $lastKey = is_array($lek) ? $this->marshaller->unmarshal($lek) : null;

        return ['items' => $items, 'lastEvaluatedKey' => $lastKey];
    }

    /**
     * COUNT query against a GSI partition — no items returned.
     */
    public function count(string $table, array $params): int
    {
        $params['TableName'] = $table;
        $params['Select']    = 'COUNT';

        $result = $this->client->query($params);

        return (int) ($result['Count'] ?? 0);
    }

    /**
     * Query session logs across date partition(s) with optional filters.
     */
    public function querySessions(
        string $startDate,
        string $endDate,
        ?string $userId = null,
        ?string $role = null,
        ?string $status = null,
        int $limit = 50,
        ?string $nextToken = null
    ): array {
        $table = $this->sessionTable();
        $start = new \DateTimeImmutable($startDate);
        $end = new \DateTimeImmutable($endDate);
        
        $allItems = [];
        $current = $start;

        while ($current <= $end) {
            $dateStr = $current->format('Y-m-d');
            $params = [
                'IndexName' => 'GSI2',
                'KeyConditionExpression' => 'GSI2PK = :pk',
                'ExpressionAttributeValues' => [
                    ':pk' => ['S' => 'DATE#' . $dateStr],
                ],
                'ScanIndexForward' => false,
            ];

            $res = $this->query($table, $params, null, $limit);
            foreach ($res['items'] as $item) {
                if ($userId && ($item['userId'] ?? '') !== $userId) continue;
                if ($role && ($item['userRole'] ?? '') !== $role) continue;
                if ($status && ($item['status'] ?? '') !== $status) continue;
                $allItems[] = $item;
            }

            $current = $current->modify('+1 day');
        }

        usort($allItems, fn($a, $b) => strcmp($b['timeIn'] ?? '', $a['timeIn'] ?? ''));

        return [
            'items' => array_slice($allItems, 0, $limit),
            'nextToken' => count($allItems) > $limit ? 'more' : null,
        ];
    }

    /**
     * Query activity logs across date partition(s) with optional filters.
     */
    public function queryActivity(
        string $startDate,
        string $endDate,
        ?string $userId = null,
        ?string $role = null,
        ?string $actionType = null,
        ?string $module = null,
        int $limit = 50,
        ?string $nextToken = null
    ): array {
        $table = $this->activityTable();
        $start = new \DateTimeImmutable($startDate);
        $end = new \DateTimeImmutable($endDate);

        $allItems = [];
        $current = $start;

        while ($current <= $end) {
            $dateStr = $current->format('Y-m-d');
            $params = [
                'IndexName' => 'GSI2',
                'KeyConditionExpression' => 'GSI2PK = :pk',
                'ExpressionAttributeValues' => [
                    ':pk' => ['S' => 'DATE#' . $dateStr],
                ],
                'ScanIndexForward' => false,
            ];

            $res = $this->query($table, $params, null, $limit);
            foreach ($res['items'] as $item) {
                if ($userId && ($item['userId'] ?? '') !== $userId) continue;
                if ($role && ($item['userRole'] ?? '') !== $role) continue;
                if ($actionType && ($item['actionType'] ?? '') !== $actionType) continue;
                if ($module && ($item['module'] ?? '') !== $module) continue;
                $allItems[] = $item;
            }

            $current = $current->modify('+1 day');
        }

        usort($allItems, fn($a, $b) => strcmp($b['timestamp'] ?? '', $a['timestamp'] ?? ''));

        return [
            'items' => array_slice($allItems, 0, $limit),
            'nextToken' => count($allItems) > $limit ? 'more' : null,
        ];
    }

    public function getActivityItem(string $activityId, string $date = ''): ?array
    {
        $table = $this->activityTable();
        $pk = 'ACTIVITY#' . $activityId;
        return $this->get($table, $pk, $pk);
    }

    public function marshaller(): ItemMarshaller
    {
        return $this->marshaller;
    }
}
