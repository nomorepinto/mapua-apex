<?php

namespace Tests\Unit\Aws\DynamoDb;

use App\Aws\DynamoDb\SignatoryChainResolver;
use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class SignatoryChainResolverTest extends TestCase
{
    public function test_single_org_chain_labels_each_desk_with_its_own_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
            ['role' => 'dean', 'signatory_id' => 'dean001'],
        ]);

        $chain = $this->resolve([
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#dean001', 'SIGNATORY#osaar001'],
        ]);

        $this->assertSame([
            ['signatory_id' => 'adv001', 'role' => 'adviser', 'organization_id' => 'a1b2', 'organization_name' => 'Proponent'],
            ['signatory_id' => 'dean001', 'role' => 'dean', 'organization_id' => 'a1b2', 'organization_name' => 'Proponent'],
            ['signatory_id' => 'osaar001', 'role' => 'osaar', 'organization_id' => null, 'organization_name' => null],
        ], $chain);
    }

    public function test_collaboration_chain_qualifies_each_desk_by_its_organization(): void
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

        $chain = $this->resolve([
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'collaboration' => ['dependent_organization_ids' => ['ORGANIZATION#dep1']],
            'signatory_sequence' => [
                'SIGNATORY#adv001',
                'SIGNATORY#adv002',
                'SIGNATORY#dean001',
                'SIGNATORY#dean002',
                'SIGNATORY#osaar001',
            ],
        ]);

        $this->assertSame([
            ['signatory_id' => 'adv001', 'role' => 'adviser', 'organization_id' => 'a1b2', 'organization_name' => 'Proponent'],
            ['signatory_id' => 'adv002', 'role' => 'adviser', 'organization_id' => 'dep1', 'organization_name' => 'Dependent One'],
            ['signatory_id' => 'dean001', 'role' => 'dean', 'organization_id' => 'a1b2', 'organization_name' => 'Proponent'],
            ['signatory_id' => 'dean002', 'role' => 'dean', 'organization_id' => 'dep1', 'organization_name' => 'Dependent One'],
            ['signatory_id' => 'osaar001', 'role' => 'osaar', 'organization_id' => null, 'organization_name' => null],
        ], $chain);
    }

    public function test_cdm_is_a_campus_desk_with_no_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db, 'a1b2', 'Proponent', [
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
        ]);

        $chain = $this->resolve([
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#osaar001', 'SIGNATORY#cdm001'],
        ]);

        $this->assertSame(
            ['signatory_id' => 'cdm001', 'role' => 'cdm', 'organization_id' => null, 'organization_name' => null],
            $chain[2],
        );
    }

    public function test_a_shared_signatory_keeps_the_first_organization_desk_it_maps_to(): void
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

        $chain = $this->resolve([
            'GSI1PK' => 'ORGANIZATION#a1b2',
            'collaboration' => ['dependent_organization_ids' => ['ORGANIZATION#dep1']],
            'signatory_sequence' => ['SIGNATORY#adv001', 'SIGNATORY#dean001', 'SIGNATORY#dean002', 'SIGNATORY#osaar001'],
        ]);

        // dean001 first appears as the proponent's dean, so that desk wins.
        $this->assertSame(
            ['signatory_id' => 'dean001', 'role' => 'dean', 'organization_id' => 'a1b2', 'organization_name' => 'Proponent'],
            $chain[1],
        );
    }

    public function test_an_empty_sequence_resolves_to_an_empty_chain(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->assertSame([], $this->resolve(['GSI1PK' => 'ORGANIZATION#a1b2']));
    }

    /**
     * @param  array<string, mixed>  $submission
     * @return list<array{signatory_id: string, role: string|null, organization_id: string|null, organization_name: string|null}>
     */
    private function resolve(array $submission): array
    {
        return $this->app->make(SignatoryChainResolver::class)->handle($submission);
    }
}
