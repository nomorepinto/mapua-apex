<?php

namespace App\Aws\DynamoDb;

final class ListSubmissionNotifications
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function handle(string $submissionId): array
    {
        return $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::submission($submissionId)],
                ':sk' => ['S' => 'NOTIFICATION#'],
            ],
        ]);
    }
}
