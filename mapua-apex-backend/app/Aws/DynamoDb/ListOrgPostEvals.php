<?php

namespace App\Aws\DynamoDb;

/**
 * An organization's post-evaluations, read straight off GSI1: each POSTEVAL item
 * carries GSI1PK=ORGANIZATION#{id} and GSI1SK=POSTEVAL#{uuid} (mirrors how
 * SUBMISSION rows are discovered), so one begins_with query returns them all.
 */
final class ListOrgPostEvals
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function handle(string $organizationId): array
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
