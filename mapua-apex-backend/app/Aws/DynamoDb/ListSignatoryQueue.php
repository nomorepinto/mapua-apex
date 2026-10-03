<?php

namespace App\Aws\DynamoDb;

final class ListSignatoryQueue
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function handle(string $signatoryId): array
    {
        return $this->items->query([
            'IndexName' => 'GSI2',
            'KeyConditionExpression' => 'GSI2PK = :signatory',
            'ExpressionAttributeValues' => [
                ':signatory' => ['S' => DynamoKeys::signatory($signatoryId)],
            ],
        ]);
    }
}
