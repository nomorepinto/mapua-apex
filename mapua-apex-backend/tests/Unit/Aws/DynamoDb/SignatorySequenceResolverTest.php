<?php

namespace Tests\Unit\Aws\DynamoDb;

use App\Aws\DynamoDb\SignatorySequenceResolver;
use PHPUnit\Framework\Attributes\DataProvider;
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
}
