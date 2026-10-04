<?php

namespace App\Aws\DynamoDb;

/**
 * Authorization for reading a submission (and its notifications) from a student
 * context. The proponent organization owns the submission (its event's GSI1PK);
 * dependent organizations — listed on `collaboration.dependent_organization_ids` —
 * may view the shared submission and its notifications, but never edit it.
 */
final class SubmissionAccess
{
    /**
     * @param  array<string, mixed>  $submission
     */
    public function authorize(array $submission, string $callerOrgId, string $proponentOrgKey, bool $requireProponent = false): void
    {
        if ($proponentOrgKey !== '' && $proponentOrgKey === DynamoKeys::organization($callerOrgId)) {
            return;
        }

        if ($requireProponent || ! $this->isDependent($submission, $callerOrgId)) {
            abort(404);
        }
    }

    /**
     * @param  array<string, mixed>  $submission
     */
    public function isDependent(array $submission, string $callerOrgId): bool
    {
        $dependents = $submission['collaboration']['dependent_organization_ids'] ?? [];
        $callerKey = DynamoKeys::organization($callerOrgId);

        return is_array($dependents) && in_array($callerKey, $dependents, true);
    }
}
