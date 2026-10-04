<?php

namespace Tests\Unit\Aws\DynamoDb;

use App\Aws\DynamoDb\SignatorySequenceResolver;
use App\Aws\DynamoDb\UnresolvableSignatoryRoute;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class SignatorySequenceResolverTest extends TestCase
{
    /**
     * @return array<string, array{0: string, 1: bool, 2: bool, 3: list<string>}>
     */
    public static function sequences(): array
    {
        return [
            'co-curricular without reservation' => ['co-curricular', false, false, ['adviser', 'dean', 'osaar']],
            'co-curricular with reservation' => ['co-curricular', true, false, ['adviser', 'dean', 'osaar', 'cdm']],
            'extra-curricular without reservation' => ['extra-curricular', false, false, ['adviser', 'osaar']],
            'extra-curricular with reservation' => ['extra-curricular', true, false, ['adviser', 'osaar', 'cdm']],
            'higher council co-curricular without reservation' => ['co-curricular', false, true, ['adviser', 'osaar']],
            'higher council co-curricular with reservation' => ['co-curricular', true, true, ['adviser', 'osaar', 'cdm']],
            'higher council extra-curricular without reservation' => ['extra-curricular', false, true, ['adviser', 'osaar']],
            'higher council extra-curricular with reservation' => ['extra-curricular', true, true, ['adviser', 'osaar', 'cdm']],
        ];
    }

    /**
     * @param  list<string>  $expected
     */
    #[DataProvider('sequences')]
    public function test_builds_the_role_sequence_from_activity_type_reservation_and_org(
        string $activityType,
        bool $hasReservation,
        bool $isHigherCouncil,
        array $expected,
    ): void {
        $roles = $this->app->make(SignatorySequenceResolver::class)->rolesFor(
            [
                'activity_classification' => ['activity_type' => $activityType],
                'venue_reservation' => ['has_reservation' => $hasReservation],
            ],
            ['is_higher_council' => $isHigherCouncil],
        );

        $this->assertSame($expected, $roles);
    }

    public function test_collaboration_orders_all_advisers_then_all_deans(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'dean', 'signatory_id' => 'dean001'],
        ]);
        DynamoFixtures::organization($db, 'dep1', 'Dependent One', [
            ['role' => 'adviser', 'signatory_id' => 'adv002'],
            ['role' => 'dean', 'signatory_id' => 'dean002'],
        ]);

        $ids = $this->app->make(SignatorySequenceResolver::class)->signatoryIdsForCollaboration(
            'a1b2',
            ['dep1'],
            $this->submission('co-curricular', false),
        );

        $this->assertSame(['adv001', 'adv002', 'dean001', 'dean002', 'osaar001'], $ids);
    }

    public function test_collaboration_extra_curricular_skips_every_dean(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'dean', 'signatory_id' => 'dean001'],
        ]);
        DynamoFixtures::organization($db, 'dep1', 'Dependent One', [
            ['role' => 'adviser', 'signatory_id' => 'adv002'],
            ['role' => 'dean', 'signatory_id' => 'dean002'],
        ]);

        $ids = $this->app->make(SignatorySequenceResolver::class)->signatoryIdsForCollaboration(
            'a1b2',
            ['dep1'],
            $this->submission('extra-curricular', false),
        );

        $this->assertSame(['adv001', 'adv002', 'osaar001'], $ids);
    }

    public function test_collaboration_skips_a_higher_council_dependent_dean(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'dean', 'signatory_id' => 'dean001'],
        ]);
        DynamoFixtures::organization($db, 'dep1', 'Council One', [
            ['role' => 'adviser', 'signatory_id' => 'adv002'],
            ['role' => 'dean', 'signatory_id' => 'dean002'],
        ], isHigherCouncil: true);

        $ids = $this->app->make(SignatorySequenceResolver::class)->signatoryIdsForCollaboration(
            'a1b2',
            ['dep1'],
            $this->submission('co-curricular', false),
        );

        $this->assertSame(['adv001', 'adv002', 'dean001', 'osaar001'], $ids);
    }

    public function test_collaboration_deduplicates_a_shared_signatory(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'dean', 'signatory_id' => 'dean001'],
        ]);
        // dep1's adviser is the same person as the proponent's dean.
        DynamoFixtures::organization($db, 'dep1', 'Dependent One', [
            ['role' => 'adviser', 'signatory_id' => 'dean001'],
            ['role' => 'dean', 'signatory_id' => 'dean002'],
        ]);

        $ids = $this->app->make(SignatorySequenceResolver::class)->signatoryIdsForCollaboration(
            'a1b2',
            ['dep1'],
            $this->submission('co-curricular', false),
        );

        $this->assertSame(['adv001', 'dean001', 'dean002', 'osaar001'], $ids);
    }

    public function test_collaboration_appends_cdm_only_with_a_reservation(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
        ]);

        $ids = $this->app->make(SignatorySequenceResolver::class)->signatoryIdsForCollaboration(
            'a1b2',
            [],
            $this->submission('extra-curricular', true),
        );

        $this->assertSame(['adv001', 'osaar001', 'cdm001'], $ids);
    }

    public function test_collaboration_throws_when_a_dependent_has_no_adviser(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
        ]);
        DynamoFixtures::organization($db, 'dep1', 'Dependent One', []);

        $this->expectException(UnresolvableSignatoryRoute::class);

        $this->app->make(SignatorySequenceResolver::class)->signatoryIdsForCollaboration(
            'a1b2',
            ['dep1'],
            $this->submission('extra-curricular', false),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function submission(string $activityType, bool $hasReservation): array
    {
        return [
            'activity_classification' => ['activity_type' => $activityType],
            'venue_reservation' => ['has_reservation' => $hasReservation],
        ];
    }
}
