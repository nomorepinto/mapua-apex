<?php

namespace App\Aws\DynamoDb;

final class NotificationRecords
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * @return array<string, mixed>|null
     */
    public function get(string $submissionId, string $sentAt): ?array
    {
        return $this->items->get(
            DynamoKeys::submission($submissionId),
            DynamoKeys::notification($this->sentAt($sentAt)),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function require(string $submissionId, string $sentAt): array
    {
        $item = $this->get($submissionId, $sentAt);

        if ($item === null) {
            abort(404);
        }

        return $item;
    }

    /**
     * @return array<string, mixed>
     */
    public function create(
        string $submissionId,
        string $signatoryId,
        string $notifType,
        string $comment = '',
        ?string $sentAt = null,
    ): array {
        $item = $this->item(
            $submissionId,
            $sentAt ?? DynamoKeys::now(),
            $signatoryId,
            $notifType,
            $comment,
        );
        $this->items->put($item);

        return $item;
    }

    /**
     * @return array<string, mixed>
     */
    public function update(
        string $submissionId,
        string $sentAt,
        string $signatoryId,
        string $notifType,
        string $comment = '',
    ): array {
        $this->require($submissionId, $sentAt);

        $item = $this->item($submissionId, $this->sentAt($sentAt), $signatoryId, $notifType, $comment);
        $this->items->put($item);

        return $item;
    }

    /**
     * @return array<string, mixed>
     */
    private function item(
        string $submissionId,
        string $sentAt,
        string $signatoryId,
        string $notifType,
        string $comment,
    ): array {
        return [
            'PK' => DynamoKeys::submission($submissionId),
            'SK' => DynamoKeys::notification($sentAt),
            'signatory' => DynamoKeys::signatory($signatoryId),
            'notif_type' => $notifType,
            'comment' => $comment,
        ];
    }

    private function sentAt(string $sentAt): string
    {
        return DynamoKeys::strip($sentAt, 'NOTIFICATION#') ?? $sentAt;
    }
}
