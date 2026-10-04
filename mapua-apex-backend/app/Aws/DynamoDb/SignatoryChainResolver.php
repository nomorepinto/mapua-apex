<?php

namespace App\Aws\DynamoDb;

final class SignatoryChainResolver
{
    public function __construct(
        private OrganizationRecords $organizations,
        private SignatoryRecords $signatories,
    ) {}

    /**
     * Expand the stored signatory_sequence snapshot into an ordered, display-ready
     * chain. Each entry carries the signatory's role plus the organization that
     * desk belongs to, so a collaboration renders "Org's Adviser", "Org's Dean",
     * "Org 2's Adviser", … instead of ambiguous bare roles. Campus desks (OSAAR,
     * CDM) belong to no organization and resolve to a null organization.
     *
     * @param  array<string, mixed>  $submission
     * @return list<array{signatory_id: string, role: string|null, organization_id: string|null, organization_name: string|null}>
     */
    public function handle(array $submission): array
    {
        $sequence = $this->stripList($submission['signatory_sequence'] ?? [], 'SIGNATORY#');

        if ($sequence === []) {
            return [];
        }

        $proponentOrgId = DynamoKeys::strip($submission['GSI1PK'] ?? null, 'ORGANIZATION#');
        $dependentOrgIds = $this->stripList(
            data_get($submission, 'collaboration.dependent_organization_ids', []),
            'ORGANIZATION#',
        );

        $orgIds = array_values(array_unique(array_filter(array_merge(
            is_string($proponentOrgId) ? [$proponentOrgId] : [],
            $dependentOrgIds,
        ), static fn ($id): bool => is_string($id) && $id !== '')));

        $deskMap = $this->deskMap($orgIds);

        $chain = [];

        foreach ($sequence as $signatoryId) {
            $desk = $deskMap[$signatoryId] ?? null;

            $chain[] = [
                'signatory_id' => $signatoryId,
                'role' => $desk['role'] ?? $this->campusOrRecordRole($signatoryId),
                'organization_id' => $desk['organization_id'] ?? null,
                'organization_name' => $desk['organization_name'] ?? null,
            ];
        }

        return $chain;
    }

    /**
     * Map each signatory id to the first organization desk that holds it, walking
     * the organizations in chain order (proponent first, then each dependent).
     *
     * @param  list<string>  $orgIds
     * @return array<string, array{role: string, organization_id: string, organization_name: string|null}>
     */
    private function deskMap(array $orgIds): array
    {
        $map = [];

        foreach ($orgIds as $orgId) {
            $organization = $this->organizations->get($orgId);

            if ($organization === null) {
                continue;
            }

            $name = is_string($organization['name'] ?? null) && $organization['name'] !== ''
                ? $organization['name']
                : null;

            foreach ($this->organizations->desks($organization) as $desk) {
                $signatoryId = $desk['signatory_id'];

                if (! isset($map[$signatoryId])) {
                    $map[$signatoryId] = [
                        'role' => $desk['role'],
                        'organization_id' => $orgId,
                        'organization_name' => $name,
                    ];
                }
            }
        }

        return $map;
    }

    /**
     * Resolve the role for a signatory that no involved organization desk holds —
     * the shared campus desks (OSAAR, CDM) configured by id, falling back to the
     * signatory record's own role.
     */
    private function campusOrRecordRole(string $signatoryId): ?string
    {
        foreach (['osaar', 'cdm'] as $role) {
            $configured = DynamoKeys::strip(config('services.signatories.'.$role.'_id'), 'SIGNATORY#');

            if (is_string($configured) && $configured !== '' && $configured === $signatoryId) {
                return $role;
            }
        }

        $signatory = $this->signatories->get($signatoryId);

        return is_string($signatory['role'] ?? null) && $signatory['role'] !== ''
            ? $signatory['role']
            : null;
    }

    /**
     * @return list<string>
     */
    private function stripList(mixed $values, string $prefix): array
    {
        if (! is_array($values)) {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn ($value): ?string => DynamoKeys::strip(is_string($value) ? $value : null, $prefix),
            $values,
        ), static fn ($value): bool => is_string($value) && $value !== ''));
    }
}
