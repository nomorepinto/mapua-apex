<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

final class FindSignatoryByRole
{
    /**
     * @var list<string>
     */
    private const CAMPUS_ROLES = ['osaar', 'cdm'];

    public function __construct(private OrganizationRecords $organizations) {}

    public function handle(string $organizationId, string $role): ?string
    {
        $wanted = Str::lower($role);

        if (in_array($wanted, self::CAMPUS_ROLES, true)) {
            return $this->campusDeskId($wanted);
        }

        $organization = $this->organizations->get($organizationId);

        if ($organization === null) {
            return null;
        }

        foreach ($this->organizations->desks($organization) as $desk) {
            if ($desk['role'] === $wanted) {
                return $desk['signatory_id'];
            }
        }

        return null;
    }

    private function campusDeskId(string $role): ?string
    {
        return DynamoKeys::strip(config('services.signatories.'.$role.'_id'), 'SIGNATORY#');
    }
}
