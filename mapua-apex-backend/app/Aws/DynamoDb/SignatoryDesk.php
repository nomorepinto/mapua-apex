<?php

namespace App\Aws\DynamoDb;

final class SignatoryDesk
{
    /**
     * A live queue entry duplicates its owner in current_signatory and GSI2PK.
     * GSI2PK is authoritative while present because it determines whose queue
     * contains the item. Fall back to current_signatory for legacy records that
     * do not carry the index property.
     *
     * @param  array<string, mixed>  $submission
     */
    public static function isOwnedBy(array $submission, string $signatoryId): bool
    {
        $signatoryKey = DynamoKeys::signatory($signatoryId);
        $queueOwner = $submission['GSI2PK'] ?? null;

        if (is_string($queueOwner) && $queueOwner !== '') {
            return $queueOwner === $signatoryKey;
        }

        return ($submission['current_signatory'] ?? null) === $signatoryKey;
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    public static function requireOpen(array $submission, string $signatoryId): void
    {
        if (! self::isOwnedBy($submission, $signatoryId)) {
            abort(404);
        }

        $status = $submission['status'] ?? null;

        if (! in_array($status, ['pending', 'returned'], true)) {
            abort(422, 'This submission is no longer open for review.');
        }
    }
}
