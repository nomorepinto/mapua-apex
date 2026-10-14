<?php

namespace Tests\Unit\Aws\DynamoDb;

use App\Aws\DynamoDb\ListOrgSubmissions;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class ListOrgSubmissionsTest extends TestCase
{
    public function test_returns_every_org_submission_even_beyond_the_old_event_cap(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        // One event per submission, mirroring WriteSubmission::create. Seeding one
        // past the former EVENT_LIMIT proves the newest papers are no longer dropped
        // by the old "first 25 events" round-trip.
        $total = ListOrgSubmissions::EVENT_LIMIT + 1;

        for ($i = 0; $i < $total; $i++) {
            $event = 'e'.$i;
            $submission = 's'.$i;

            DynamoFixtures::event($db, 'a1b2', $event);
            DynamoFixtures::submission($db, [
                'PK' => 'EVENT#'.$event,
                'SK' => 'SUBMISSION#'.$submission,
                'GSI1PK' => 'ORGANIZATION#a1b2',
                'GSI1SK' => 'SUBMISSION#'.$submission,
            ]);
        }

        $submissions = $this->app->make(ListOrgSubmissions::class)->handle('a1b2');

        $this->assertCount($total, $submissions);
        $this->assertContains(
            'SUBMISSION#s'.($total - 1),
            array_map(static fn (array $submission): string => (string) $submission['SK'], $submissions),
        );
    }

    public function test_returns_an_empty_list_when_the_organization_has_no_submissions(): void
    {
        InMemoryDynamoDb::bind($this);

        $submissions = $this->app->make(ListOrgSubmissions::class)->handle('missing-org');

        $this->assertSame([], $submissions);
    }
}
