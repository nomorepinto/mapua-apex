<?php

namespace Tests\Unit\Aws\DynamoDb;

use App\Aws\DynamoDb\FindSignatoryByRole;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class FindSignatoryByRoleTest extends TestCase
{
    public function test_osaar_and_cdm_come_from_signatory_rows_not_the_org_desk_list(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, signatories: [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'dean', 'signatory_id' => 'dean001'],
            ['role' => 'osaar', 'signatory_id' => 'desk-osaar'],
            ['role' => 'cdm', 'signatory_id' => 'desk-cdm'],
        ]);
        DynamoFixtures::signatory($db, 'osaar001', 'osaar', 'other-org');
        DynamoFixtures::signatory($db, 'cdm001', 'cdm', 'other-org');

        $finder = $this->app->make(FindSignatoryByRole::class);

        $this->assertSame('adv001', $finder->handle('a1b2', 'adviser'));
        $this->assertSame('dean001', $finder->handle('a1b2', 'dean'));
        $this->assertSame('osaar001', $finder->handle('a1b2', 'osaar'));
        $this->assertSame('cdm001', $finder->handle('a1b2', 'cdm'));
    }

    public function test_missing_campus_signatory_returns_null(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->assertNull($this->app->make(FindSignatoryByRole::class)->handle('a1b2', 'osaar'));
    }

    public function test_more_than_one_campus_signatory_returns_null(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::signatory($db, 'osaar001', 'osaar', 'other-org');
        DynamoFixtures::signatory($db, 'osaar002', 'osaar', 'other-org');

        $this->assertNull($this->app->make(FindSignatoryByRole::class)->handle('a1b2', 'osaar'));
    }
}
