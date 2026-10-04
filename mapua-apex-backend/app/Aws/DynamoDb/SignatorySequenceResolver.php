<?php

namespace App\Aws\DynamoDb;

final class SignatorySequenceResolver
{
    public function __construct(
        private FindSignatoryByRole $findSignatoryByRole,
        private OrganizationRecords $organizations,
    ) {}

    /**
     * Co-curricular (academic) events go Adviser → Dean → OSAAR.
     * Extra-curricular events skip Dean: Adviser → OSAAR.
     * A venue reservation then adds CDM after OSAAR.
     * Higher-council organizations still start at Adviser but skip Dean.
     *
     * @param  array<string, mixed>  $submission
     * @param  array<string, mixed>  $organization
     * @return list<string>
     */
    public function rolesFor(array $submission, array $organization = []): array
    {
        $roles = ['adviser'];

        if (
            data_get($submission, 'activity_classification.activity_type') === 'co-curricular'
            && ($organization['is_higher_council'] ?? false) !== true
        ) {
            $roles[] = 'dean';
        }

        $roles[] = 'osaar';

        if (data_get($submission, 'venue_reservation.has_reservation') === true) {
            $roles[] = 'cdm';
        }

        return $roles;
    }

    /**
     * @param  array<string, mixed>  $submission
     * @return list<string>
     */
    public function signatoryIds(string $organizationId, array $submission): array
    {
        $organization = $this->organizations->get($organizationId) ?? [];
        $ids = [];

        foreach ($this->rolesFor($submission, $organization) as $role) {
            $signatoryId = $this->findSignatoryByRole->handle($organizationId, $role);

            if ($signatoryId === null) {
                throw new UnresolvableSignatoryRoute(
                    in_array($role, ['osaar', 'cdm'], true)
                        ? "No {$role} signatory is configured."
                        : "No {$role} signatory is assigned for this organization."
                );
            }

            $ids[] = $signatoryId;
        }

        return $ids;
    }

    /**
     * Build the approval chain for a collaboration: every involved org's adviser
     * (proponent first, then each dependent in order), then every involved org's
     * dean (only when the activity is co-curricular and the org is not a higher
     * council), then the shared campus desks (OSAAR, then CDM when a venue is
     * reserved). Signatory ids are de-duplicated preserving first occurrence, so
     * a person who holds several desks signs only once.
     *
     * @param  list<string>  $dependentOrgIds
     * @param  array<string, mixed>  $submission
     * @return list<string>
     */
    public function signatoryIdsForCollaboration(string $proponentOrgId, array $dependentOrgIds, array $submission): array
    {
        $organizationIds = array_values(array_unique(array_filter(
            array_merge([$proponentOrgId], $dependentOrgIds),
            static fn ($id): bool => is_string($id) && $id !== '',
        )));

        $organizations = [];

        foreach ($organizationIds as $orgId) {
            $organizations[$orgId] = $this->organizations->get($orgId) ?? [];
        }

        $isCoCurricular = data_get($submission, 'activity_classification.activity_type') === 'co-curricular';
        $hasReservation = data_get($submission, 'venue_reservation.has_reservation') === true;

        $ids = [];

        // Advisers pass — every org, proponent first.
        foreach ($organizationIds as $orgId) {
            $ids[] = $this->deskSignatory($organizations[$orgId], 'adviser');
        }

        // Deans pass — co-curricular orgs that are not higher council.
        if ($isCoCurricular) {
            foreach ($organizationIds as $orgId) {
                if (($organizations[$orgId]['is_higher_council'] ?? false) === true) {
                    continue;
                }

                $ids[] = $this->deskSignatory($organizations[$orgId], 'dean');
            }
        }

        // Shared campus desks.
        $ids[] = $this->campusSignatory($proponentOrgId, 'osaar');

        if ($hasReservation) {
            $ids[] = $this->campusSignatory($proponentOrgId, 'cdm');
        }

        return array_values(array_unique($ids));
    }

    /**
     * @param  array<string, mixed>  $organization
     */
    private function deskSignatory(array $organization, string $role): string
    {
        foreach ($this->organizations->desks($organization) as $desk) {
            if ($desk['role'] === $role) {
                return $desk['signatory_id'];
            }
        }

        $name = is_string($organization['name'] ?? null) && $organization['name'] !== ''
            ? " for {$organization['name']}"
            : '';

        throw new UnresolvableSignatoryRoute("No {$role} signatory is assigned{$name}.");
    }

    private function campusSignatory(string $proponentOrgId, string $role): string
    {
        $signatoryId = $this->findSignatoryByRole->handle($proponentOrgId, $role);

        if ($signatoryId === null) {
            throw new UnresolvableSignatoryRoute("No {$role} signatory is configured.");
        }

        return $signatoryId;
    }
}
