<?php

namespace Tests\Unit\Aws\DynamoDb;

use App\Aws\DynamoDb\FindSignatoryByRole;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class FindSignatoryByRoleTest extends TestCase
{
    public function test_osaar_and_cdm_come_from_env_not_the_org_desk_list(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, signatories: [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'dean', 'signatory_id' => 'dean001'],
        ]);

        $finder = $this->app->make(FindSignatoryByRole::class);

        $this->assertSame('adv001', $finder->handle('a1b2', 'adviser'));
        $this->assertSame('dean001', $finder->handle('a1b2', 'dean'));
        $this->assertSame('osaar001', $finder->handle('a1b2', 'osaar'));
        $this->assertSame('cdm001', $finder->handle('a1b2', 'cdm'));
    }

    public function test_campus_ids_accept_a_signatory_prefix(): void
    {
        config(['services.signatories.osaar_id' => 'SIGNATORY#campus-osaar']);

        $this->assertSame(
            'campus-osaar',
            $this->app->make(FindSignatoryByRole::class)->handle('a1b2', 'osaar'),
        );
    }

    public function test_missing_campus_env_returns_null(): void
    {
        config(['services.signatories.osaar_id' => '']);

        $this->assertNull($this->app->make(FindSignatoryByRole::class)->handle('a1b2', 'osaar'));
    }
}
