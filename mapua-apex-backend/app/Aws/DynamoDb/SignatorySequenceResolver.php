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
}
