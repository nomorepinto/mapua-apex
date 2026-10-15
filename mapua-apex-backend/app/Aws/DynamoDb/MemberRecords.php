<?php

namespace App\Aws\DynamoDb;

use Aws\DynamoDb\DynamoDbClient;

final class MemberRecords
{
    public function __construct(
        private DynamoDbItems $items,
        private DynamoDbClient $dynamo,
    ) {}

    /**
     * List all members belonging to an organization.
     *
     * @return list<array<string, mixed>>
     */
    public function list(string $organizationId): array
    {
        $pk = DynamoKeys::organization($organizationId);

        return $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => $pk],
                ':sk' => ['S' => 'MEMBER#'],
            ],
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get(string $organizationId, string $studentId): ?array
    {
        $pk = DynamoKeys::organization($organizationId);
        $sk = DynamoKeys::member($studentId);

        return $this->items->get($pk, $sk);
    }

    /**
     * Create a single member. Aborts 409 if the student already belongs to the org.
     *
     * @return array<string, mixed>
     */
    public function create(string $organizationId, string $studentId, string $lastName, string $firstName): array
    {
        $pk = DynamoKeys::organization($organizationId);
        $sk = DynamoKeys::member($studentId);

        $item = [
            'PK' => $pk,
            'SK' => $sk,
            'lastname' => $lastName,
            'firstname' => $firstName,
            'student_number' => $studentId,
        ];

        try {
            $this->items->put($item, 'attribute_not_exists(SK)');
        } catch (\Aws\DynamoDb\Exception\DynamoDbException $e) {
            if ($e->getAwsErrorCode() === 'ConditionalCheckFailedException') {
                abort(409, 'A member with this student number already exists.');
            }

            throw $e;
        }

        return $item;
    }

    /**
     * Bulk-create members (max 25 per BatchWriteItem chunk).
     * Returns created items and failed duplicates.
     *
     * @param  list<array{student_number: string, lastname: string, firstname: string}>  $members
     * @return array{created: list<array<string, mixed>>, failed: list<array{student_number: string, error: string}>}
     */
    public function bulkCreate(string $organizationId, array $members): array
    {
        $pk = DynamoKeys::organization($organizationId);

        // Pre-fetch existing member SKs to detect duplicates.
        $existing = $this->list($organizationId);
        $existingIds = [];

        foreach ($existing as $row) {
            $id = DynamoKeys::strip($row['SK'] ?? '', 'MEMBER#');

            if ($id !== null) {
                $existingIds[$id] = true;
            }
        }

        $created = [];
        $failed = [];
        $toWrite = [];

        foreach ($members as $member) {
            $studentId = $member['student_number'];

            if (isset($existingIds[$studentId])) {
                $failed[] = [
                    'student_number' => $studentId,
                    'error' => 'Already exists in this organization.',
                ];

                continue;
            }

            // Deduplicate within the batch itself.
            $existingIds[$studentId] = true;

            $sk = DynamoKeys::member($studentId);
            $item = [
                'PK' => $pk,
                'SK' => $sk,
                'lastname' => $member['lastname'],
                'firstname' => $member['firstname'],
                'student_number' => $studentId,
            ];

            $toWrite[] = $item;
            $created[] = $item;
        }

        // Write in chunks of 25 (DynamoDB BatchWriteItem limit).
        $marshaller = $this->items->marshaller();
        $tableName = $this->items->table();

        foreach (array_chunk($toWrite, 25) as $chunk) {
            $requestItems = array_map(fn (array $item) => [
                'PutRequest' => ['Item' => $marshaller->marshal($item)],
            ], $chunk);

            $this->dynamo->batchWriteItem([
                'RequestItems' => [$tableName => $requestItems],
            ]);
        }

        return ['created' => $created, 'failed' => $failed];
    }

    /**
     * Update a member's lastname/firstname.
     *
     * @return array<string, mixed>
     */
    public function update(string $organizationId, string $studentId, string $lastName, string $firstName): array
    {
        $pk = DynamoKeys::organization($organizationId);
        $sk = DynamoKeys::member($studentId);

        $existing = $this->items->get($pk, $sk);

        if ($existing === null) {
            abort(404, 'Member not found.');
        }

        $this->items->patch($pk, $sk, [
            'lastname' => $lastName,
            'firstname' => $firstName,
        ]);

        return [
            'PK' => $pk,
            'SK' => $sk,
            'lastname' => $lastName,
            'firstname' => $firstName,
            'student_number' => $studentId,
        ];
    }

    /**
     * Remove a member from the organization.
     */
    public function delete(string $organizationId, string $studentId): void
    {
        $pk = DynamoKeys::organization($organizationId);
        $sk = DynamoKeys::member($studentId);

        if ($this->items->get($pk, $sk) === null) {
            abort(404, 'Member not found.');
        }

        $this->items->delete($pk, $sk);
    }

    /**
     * Check whether a student is a member of the given organization.
     */
    public function isMember(string $organizationId, string $studentId): bool
    {
        $pk = DynamoKeys::organization($organizationId);
        $sk = DynamoKeys::member($studentId);

        return $this->items->get($pk, $sk) !== null;
    }
}
