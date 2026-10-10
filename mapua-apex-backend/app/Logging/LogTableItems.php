<?php

namespace App\Logging;

use App\Aws\AwsClientFactory;
use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\ItemMarshaller;
use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Exception\DynamoDbException;

/**
 * DynamoDB client wrapper for the two append-only log tables.
 * Intentionally separate from DynamoDbItems (main app table) so
 * misconfiguration cannot mix log data with application data.
 */
final class LogTableItems
{
    private readonly DynamoDbClient $client;

    private readonly ItemMarshaller $marshaller;

    public function __construct(mixed $factoryOrClient = null, ?DynamoDbClient $client = null)
    {
        if ($factoryOrClient instanceof DynamoDbClient) {
            $this->client = $factoryOrClient;
        } elseif ($client !== null) {
            $this->client = $client;
        } else {
            $factory = $factoryOrClient instanceof AwsClientFactory ? $factoryOrClient : app(AwsClientFactory::class);
            $this->client = new DynamoDbClient($factory->clientOptions('dynamodb'));
        }
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
            'Item' => $this->marshaller->marshal($item),
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
                'TableName' => $table,
                'Item' => $this->marshaller->marshal($item),
                'ConditionExpression' => $conditionExpression,
            ]);

            return true;
        } catch (DynamoDbException $e) {
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
            'TableName' => $table,
            'Key' => $this->marshaller->marshal(['PK' => $pk, 'SK' => $sk]),
            'ConsistentRead' => true,
        ]);

        $item = $result['Item'] ?? null;

        return is_array($item) ? $this->marshaller->unmarshal($item) : null;
    }

    /**
     * Update specific attributes on an existing item.
     *
     * @param  array<string, mixed>  $set
     * @param  list<string>  $remove
     */
    public function patch(string $table, string $pk, string $sk, array $set = [], array $remove = []): void
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
            'TableName' => $table,
            'Key' => $this->marshaller->marshal(['PK' => $pk, 'SK' => $sk]),
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
     * @param  array<string, mixed>  $params
     * @param  array<string, mixed>|null  $exclusiveStartKey
     * @return array{items: list<array<string, mixed>>, lastEvaluatedKey: array<string, mixed>|null}
     */
    public function query(string $table, array $params, ?array $exclusiveStartKey = null, int $limit = 50): array
    {
        $params['TableName'] = $table;
        $params['Limit'] = $limit;

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
        $params['Select'] = 'COUNT';

        $result = $this->client->query($params);

        return (int) ($result['Count'] ?? 0);
    }

    /**
     * Query session logs across monthly bucket partition(s) with optional filters.
     * Uses GSI1 (LOG#SESSION#{YYYY-MM}) as defined in plan §2.1.
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

        // Collect unique YYYY-MM buckets spanning the date range
        $buckets = [];
        $current = $start;

        while ($current <= $end) {
            $ym = $current->format('Y-m');

            if (! in_array($ym, $buckets, true)) {
                $buckets[] = $ym;
            }

            $current = $current->modify('+1 day');
        }

        $allItems = [];

        foreach ($buckets as $ym) {
            $gsi1Pk = 'LOG#SESSION#'.$ym;

            // Date range SK bounds within the bucket
            $skStart = $start->format('Y-m-d').'T00:00:00Z';
            $skEnd = $end->format('Y-m-d').'T23:59:59Z';

            $params = [
                'IndexName' => 'GSI1',
                'KeyConditionExpression' => 'GSI1PK = :pk AND GSI1SK BETWEEN :skStart AND :skEnd',
                'ExpressionAttributeValues' => [
                    ':pk' => ['S' => $gsi1Pk],
                    ':skStart' => ['S' => $skStart],
                    ':skEnd' => ['S' => $skEnd],
                ],
                'ScanIndexForward' => false,
            ];

            $res = $this->query($table, $params, null, $limit);

            foreach ($res['items'] as $item) {
                if ($userId !== null && ($item['sub'] ?? '') !== $userId) {
                    continue;
                }

                if ($role !== null && ($item['user_role'] ?? '') !== $role) {
                    continue;
                }

                if ($status !== null && ($item['status'] ?? '') !== $status) {
                    continue;
                }

                $allItems[] = $item;
            }
        }

        usort($allItems, fn ($a, $b) => strcmp($b['login_time'] ?? '', $a['login_time'] ?? ''));

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
                'IndexName' => 'GSI3',
                'KeyConditionExpression' => 'GSI3PK = :pk',
                'ExpressionAttributeValues' => [
                    ':pk' => ['S' => 'DATE#'.$dateStr],
                ],
                'ScanIndexForward' => false,
            ];

            $res = $this->query($table, $params, null, $limit);
            foreach ($res['items'] as $item) {
                if ($userId && ($item['userId'] ?? '') !== $userId) {
                    continue;
                }
                if ($role && ($item['userRole'] ?? '') !== $role) {
                    continue;
                }
                if ($actionType !== null && trim($actionType) !== '') {
                    $itemAction = strtoupper((string) ($item['actionType'] ?? ''));
                    $targetAction = strtoupper(trim($actionType));
                    $matches = ($itemAction === $targetAction)
                        || (str_contains($itemAction, $targetAction))
                        || (str_contains($targetAction, $itemAction))
                        || ($targetAction === 'APPROVED' && str_contains($itemAction, 'APPROVE'))
                        || ($targetAction === 'RETURNED' && str_contains($itemAction, 'RETURN'))
                        || ($targetAction === 'DENIED' && str_contains($itemAction, 'DENY'));
                    if (! $matches) {
                        continue;
                    }
                }
                if ($module && ($item['module'] ?? '') !== $module) {
                    continue;
                }
                $allItems[] = $item;
            }

            $current = $current->modify('+1 day');
        }

        usort($allItems, fn ($a, $b) => strcmp($b['timestamp'] ?? '', $a['timestamp'] ?? ''));

        return [
            'items' => array_slice($allItems, 0, $limit),
            'nextToken' => count($allItems) > $limit ? 'more' : null,
        ];
    }

    public function getSessionItem(string $sessionId): ?array
    {
        $table = $this->sessionTable();
        $pk = 'SESSION#'.ltrim($sessionId, 'SESSION#');

        return $this->get($table, $pk, 'METADATA');
    }

    public function getActivityItem(string $activityId, string $date = ''): ?array
    {
        $table = $this->activityTable();
        $pk = 'ACTIVITY#'.$activityId;

        return $this->get($table, $pk, $pk);
    }

    public function getActiveSessionPointer(string $sub): ?array
    {
        $table = $this->sessionTable();
        $pk = DynamoKeys::user($sub);

        return $this->get($table, $pk, DynamoKeys::activeSessionSk());
    }

    public function putActiveSessionPointer(string $sub, string $sessionId, ?string $deviceId, string $now, int $ttl): void
    {
        $table = $this->sessionTable();
        $item = [
            'PK' => DynamoKeys::user($sub),
            'SK' => DynamoKeys::activeSessionSk(),
            'sub' => $sub,
            'session_id' => $sessionId,
            'status' => 'active',
            'login_time' => $now,
            'last_heartbeat' => $now,
            'TTL' => $ttl,
        ];

        if ($deviceId !== null && trim($deviceId) !== '') {
            $item['device_id'] = trim($deviceId);
        }

        $this->put($table, $item);
    }

    public function clearActiveSessionPointerIfMatches(string $sub, string $sessionId): bool
    {
        $table = $this->sessionTable();
        $pk = DynamoKeys::user($sub);
        $sk = DynamoKeys::activeSessionSk();

        try {
            $this->client->deleteItem([
                'TableName' => $table,
                'Key' => $this->marshaller->marshal(['PK' => $pk, 'SK' => $sk]),
                'ConditionExpression' => 'session_id = :sid',
                'ExpressionAttributeValues' => $this->marshaller->marshal([':sid' => $sessionId]),
            ]);

            return true;
        } catch (DynamoDbException $e) {
            if ($e->getAwsErrorCode() === 'ConditionalCheckFailedException') {
                return false;
            }
            throw $e;
        }
    }

    public function transactWrite(array $transactItems): void
    {
        $this->client->transactWriteItems([
            'TransactItems' => $transactItems,
        ]);
    }

    public function makeTransactPut(string $table, array $item, ?string $conditionExpression = null): array
    {
        $put = [
            'TableName' => $table,
            'Item' => $this->marshaller->marshal($item),
        ];
        if ($conditionExpression !== null) {
            $put['ConditionExpression'] = $conditionExpression;
        }

        return ['Put' => $put];
    }

    public function makeTransactUpdate(
        string $table,
        string $pk,
        string $sk,
        string $updateExpression,
        array $expressionAttributeNames,
        array $expressionAttributeValues,
        ?string $conditionExpression = null
    ): array {
        $update = [
            'TableName' => $table,
            'Key' => $this->marshaller->marshal(['PK' => $pk, 'SK' => $sk]),
            'UpdateExpression' => $updateExpression,
            'ExpressionAttributeNames' => $expressionAttributeNames,
            'ExpressionAttributeValues' => $this->marshaller->marshal($expressionAttributeValues),
        ];
        if ($conditionExpression !== null) {
            $update['ConditionExpression'] = $conditionExpression;
        }

        return ['Update' => $update];
    }

    public function marshaller(): ItemMarshaller
    {
        return $this->marshaller;
    }
}
