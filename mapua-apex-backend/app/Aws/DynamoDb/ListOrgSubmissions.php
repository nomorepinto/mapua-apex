<?php

namespace App\Aws\DynamoDb;

final class ListOrgSubmissions
{
    public const EVENT_LIMIT = 25;

    public function __construct(private DynamoDbItems $items) {}

    /**
     * An organization's own submissions, read straight off GSI1: each SUBMISSION
     * item carries GSI1PK=ORGANIZATION#{id} and GSI1SK=SUBMISSION#{uuid} (the same
     * discovery path the admin list and ListOrgPostEvals use), so one begins_with
     * query returns every paper with full pagination and no cap.
     *
     * The previous event-round-trip capped at the EVENT_LIMIT oldest events, so once
     * an org passed that many events its newest submissions silently dropped off the
     * student dashboard (and their timeline reminders with them).
     *
     * @return list<array<string, mixed>>
     */
    public function handle(string $organizationId): array
    {
        return $this->items->query([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :org AND begins_with(GSI1SK, :sk)',
            'ExpressionAttributeValues' => [
                ':org' => ['S' => DynamoKeys::organization($organizationId)],
                ':sk' => ['S' => 'SUBMISSION#'],
            ],
        ]);
    }

    /**
     * EVENT items for an organization (oldest first, capped at EVENT_LIMIT).
     *
     * Retained for ListOrgDeadlines, which still walks each EVENT partition for its
     * DEADLINE# children rather than reading the submission rows.
     *
     * @return list<array<string, mixed>>
     */
    public function eventsForOrganization(string $organizationId, int $eventLimit = self::EVENT_LIMIT): array
    {
        return $this->items->query([
            'IndexName' => 'GSI1',
            'KeyConditionExpression' => 'GSI1PK = :org',
            'ExpressionAttributeValues' => [
                ':org' => ['S' => DynamoKeys::organization($organizationId)],
            ],
            'Limit' => $eventLimit,
        ], allPages: false);
    }
}
