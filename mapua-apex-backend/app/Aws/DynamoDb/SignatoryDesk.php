<?php

namespace App\Aws\DynamoDb;

final class SignatoryDesk
{
    /**
     * @param  array<string, mixed>  $submission
     */
    public static function requireOpen(array $submission, string $signatoryId): void
    {
        if (($submission['current_signatory'] ?? null) !== DynamoKeys::signatory($signatoryId)) {
            abort(404);
        }

        $status = $submission['status'] ?? null;

        if (! in_array($status, ['pending', 'returned'], true)) {
            abort(422, 'This submission is no longer open for review.');
        }
    }
}
