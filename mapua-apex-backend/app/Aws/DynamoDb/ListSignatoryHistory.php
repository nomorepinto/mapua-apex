<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

final class ListSignatoryHistory
{
    public function __construct(
        private DynamoDbItems $items,
        private OrganizationRecords $organizations,
        private SignatoryRecords $signatories,
    ) {}

    /**
     * Return all submissions that belong in the history view for the given signatory.
     *
     * Role requirements:
     *   - OSAAR / CDM / Admin: Sees ALL submission history across all organizations.
     *   - Adviser: Sees all submissions from the organizations they are handling (or in sequence).
     *   - Dean: Sees all event proposals under their department (or in sequence).
     *
     * In all cases, items actively sitting on their desk for review (pending/returned with
     * current_signatory === this signatory) are excluded because they are in the live queue.
     *
     * @return list<array<string, mixed>>
     */
    public function handle(string $signatoryId): array
    {
        $signatoryKey = DynamoKeys::signatory($signatoryId);
        $signatory = $this->signatories->get($signatoryId);
        $role = Str::lower($signatory['role'] ?? '');
        $department = isset($signatory['department']) && is_string($signatory['department'])
            ? Str::upper(trim($signatory['department']))
            : null;

        $allOrgs = $this->allOrganizations();
        $history = [];

        // For advisers: collect organization IDs they handle
        $handledOrgIds = [];
        if ($role === 'adviser') {
            foreach ($allOrgs as $orgId => $org) {
                foreach ($this->organizations->desks($org) as $desk) {
                    if (($desk['signatory_id'] ?? null) === $signatoryId) {
                        $handledOrgIds[$orgId] = true;
                        break;
                    }
                }
            }
        }

        foreach ($allOrgs as $orgId => $org) {
            $name = $org['name'] ?? null;
            $submissions = $this->submissionsForOrganization($orgId);

            foreach ($submissions as $item) {
                if ($this->isCurrentlyOnDesk($item, $signatoryKey)) {
                    continue;
                }

                if (! $this->shouldIncludeSubmission($item, $role, $department, $orgId, $handledOrgIds, $signatoryKey)) {
                    continue;
                }

                if (is_string($name) && $name !== '') {
                    $item['organization_name'] = $name;
                }

                $history[] = $item;
            }
        }

        return array_values($history);
    }

    /**
     * Check if a submission should be visible in history for this signatory.
     *
     * @param  array<string, mixed>  $submission
     * @param  array<string, bool>  $handledOrgIds
     */
    public function shouldIncludeSubmission(
        array $submission,
        string $role,
        ?string $department,
        string $orgId,
        array $handledOrgIds,
        string $signatoryKey,
    ): bool {
        // OSAAR, CDM, and Admin see all submissions across all orgs
        if (in_array($role, ['osaar', 'cdm', 'admin'], true)) {
            return true;
        }

        // Advisers see submissions from the organizations they handle, or where they are in the sequence
        if ($role === 'adviser') {
            if (isset($handledOrgIds[$orgId])) {
                return true;
            }

            return $this->signatoryInSequence($submission, $signatoryKey);
        }

        // Deans see event proposals under their department, or where they are in the sequence
        if ($role === 'dean') {
            if ($department !== null && $this->matchesDepartment($submission, $department)) {
                return true;
            }

            return $this->signatoryInSequence($submission, $signatoryKey);
        }

        // Fallback: check if the signatory is in the sequence
        return $this->signatoryInSequence($submission, $signatoryKey);
    }

    /**
     * Check if a submission matches a dean's department (e.g. "SOIT", "CEGE", "SEECE").
     *
     * @param  array<string, mixed>  $submission
     */
    private function matchesDepartment(array $submission, string $department): bool
    {
        $deptUpper = Str::upper($department);

        // Check top-level department field if present
        if (isset($submission['department']) && is_string($submission['department'])) {
            if (str_contains(Str::upper($submission['department']), $deptUpper)) {
                return true;
            }
        }

        // Check proponents' department
        $proponents = $submission['proponents'] ?? [];
        if (is_array($proponents)) {
            foreach ($proponents as $proponent) {
                if (is_array($proponent) && isset($proponent['department']) && is_string($proponent['department'])) {
                    if (str_contains(Str::upper($proponent['department']), $deptUpper)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function allOrganizations(): array
    {
        $map = [];

        foreach ($this->organizations->list() as $org) {
            $id = DynamoKeys::strip($org['PK'] ?? null, 'ORGANIZATION#');

            if (is_string($id) && $id !== '') {
                $map[$id] = $org;
            }
        }

        return $map;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function submissionsForOrganization(string $organizationId): array
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
     * Returns true when the signatory key appears anywhere in signatory_sequence.
     *
     * @param  array<string, mixed>  $submission
     */
    public function signatoryInSequence(array $submission, string $signatoryKey): bool
    {
        $sequence = $submission['signatory_sequence'] ?? null;

        if (! is_array($sequence) || $sequence === []) {
            return false;
        }

        foreach ($sequence as $entry) {
            if (! is_string($entry) || $entry === '') {
                continue;
            }

            $normalised = str_starts_with($entry, 'SIGNATORY#') ? $entry : 'SIGNATORY#'.$entry;

            if ($normalised === $signatoryKey) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns true when the submission is still actively on this signatory's
     * desk (pending or returned status AND current_signatory matches).
     *
     * @param  array<string, mixed>  $submission
     */
    private function isCurrentlyOnDesk(array $submission, string $signatoryKey): bool
    {
        $status = $submission['status'] ?? null;

        if (! in_array($status, ['pending', 'returned'], true)) {
            return false;
        }

        $current = $submission['current_signatory'] ?? null;

        if (! is_string($current) || $current === '') {
            return false;
        }

        $normalised = str_starts_with($current, 'SIGNATORY#') ? $current : 'SIGNATORY#'.$current;

        return $normalised === $signatoryKey;
    }
}
