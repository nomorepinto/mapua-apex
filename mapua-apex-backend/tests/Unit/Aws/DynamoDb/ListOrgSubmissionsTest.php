<?php

namespace Tests\Unit\Aws\DynamoDb;

use App\Aws\DynamoDb\DynamoDbItems;
use App\Aws\DynamoDb\ListOrgSubmissions;
use Aws\DynamoDb\DynamoDbClient;
use Mockery;
use Tests\TestCase;

class ListOrgSubmissionsTest extends TestCase
{
    public function test_queries_gsi1_events_then_submissions_per_event(): void
    {
        $dynamo = Mockery::mock(DynamoDbClient::class);
        $dynamo->shouldReceive('query')
            ->once()
            ->with(Mockery::on(function (array $args): bool {
                return ($args['IndexName'] ?? null) === 'GSI1'
                    && ($args['TableName'] ?? null) === 'mapua-apex-test'
                    && ($args['Limit'] ?? null) === ListOrgSubmissions::EVENT_LIMIT
                    && ($args['ExpressionAttributeValues'][':org']['S'] ?? null) === 'ORGANIZATION#a1b2';
            }))
            ->andReturn([
                'Items' => [
                    [
                        'PK' => ['S' => 'EVENT#e001'],
                        'SK' => ['S' => 'EVENT#e001'],
                    ],
                ],
            ]);
        $dynamo->shouldReceive('query')
            ->once()
            ->with(Mockery::on(function (array $args): bool {
                return ($args['IndexName'] ?? null) === null
                    && ($args['ExpressionAttributeValues'][':pk']['S'] ?? null) === 'EVENT#e001'
                    && ($args['ExpressionAttributeValues'][':sk']['S'] ?? null) === 'SUBMISSION#';
            }))
            ->andReturn([
                'Items' => [
                    [
                        'PK' => ['S' => 'EVENT#e001'],
                        'SK' => ['S' => 'SUBMISSION#s001'],
                        'submission_type' => ['S' => 'saaf'],
                        'sent_at' => ['S' => '2026-09-10T14:00:00Z'],
                        'current_signatory' => ['S' => 'SIGNATORY#adv001'],
                        'activity_classification' => ['M' => [
                            'activity_type' => ['S' => 'extra-curricular'],
                            'total_org_members' => ['N' => '42'],
                        ]],
                    ],
                ],
            ]);

        $submissions = (new ListOrgSubmissions(new DynamoDbItems($dynamo)))->handle('a1b2');

        $this->assertSame([
            [
                'PK' => 'EVENT#e001',
                'SK' => 'SUBMISSION#s001',
                'submission_type' => 'saaf',
                'sent_at' => '2026-09-10T14:00:00Z',
                'current_signatory' => 'SIGNATORY#adv001',
                'activity_classification' => [
                    'activity_type' => 'extra-curricular',
                    'total_org_members' => 42,
                ],
            ],
        ], $submissions);
    }

    public function test_returns_an_empty_list_when_the_organization_has_no_events(): void
    {
        $dynamo = Mockery::mock(DynamoDbClient::class);
        $dynamo->shouldReceive('query')
            ->once()
            ->andReturn(['Items' => []]);

        $submissions = (new ListOrgSubmissions(new DynamoDbItems($dynamo)))->handle('missing-org');

        $this->assertSame([], $submissions);
    }
}
