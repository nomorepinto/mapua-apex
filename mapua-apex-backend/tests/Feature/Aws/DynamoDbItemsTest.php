<?php

namespace Tests\Feature\Aws;

use App\Aws\DynamoDb\DynamoDbItems;
use App\Aws\DynamoDb\ItemMarshaller;
use Aws\DynamoDb\DynamoDbClient;
use Illuminate\Support\Sleep;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class DynamoDbItemsTest extends TestCase
{
    public function test_batch_get_chunks_deduplicates_and_unmarshals_items(): void
    {
        $table = (string) config('aws.dynamodb.table');
        $keys = array_map(static fn (int $id): array => ['PK' => 'EVENT#'.$id, 'SK' => 'MEMBER#student'], range(1, 101));
        $marshaller = new ItemMarshaller;
        $marshalled = array_map($marshaller->marshal(...), $keys);
        $client = Mockery::mock(DynamoDbClient::class);
        $client->shouldReceive('batchGetItem')->once()->with([
            'RequestItems' => [$table => ['Keys' => array_slice($marshalled, 0, 100), 'ConsistentRead' => true]],
        ])->andReturn(['Responses' => [$table => [$marshalled[0]]]]);
        $client->shouldReceive('batchGetItem')->once()->with([
            'RequestItems' => [$table => ['Keys' => [$marshalled[100]], 'ConsistentRead' => true]],
        ])->andReturn(['Responses' => [$table => [$marshalled[100]]], 'UnprocessedKeys' => []]);
        $this->swapDynamoDbClient($client);

        $result = app(DynamoDbItems::class)->batchGet([...$keys, $keys[0]]);

        $this->assertSame([$keys[0], $keys[100]], $result);
    }

    public function test_batch_get_retries_only_unprocessed_keys(): void
    {
        Sleep::fake();
        $table = (string) config('aws.dynamodb.table');
        $keys = [['PK' => 'EVENT#1', 'SK' => 'MEMBER#student'], ['PK' => 'EVENT#2', 'SK' => 'MEMBER#student']];
        $marshaller = new ItemMarshaller;
        $marshalled = array_map($marshaller->marshal(...), $keys);
        $pending = [$table => ['Keys' => [$marshalled[1]], 'ConsistentRead' => true]];
        $client = Mockery::mock(DynamoDbClient::class);
        $client->shouldReceive('batchGetItem')->once()->with([
            'RequestItems' => [$table => ['Keys' => $marshalled, 'ConsistentRead' => true]],
        ])->andReturn(['Responses' => [$table => [$marshalled[0]]], 'UnprocessedKeys' => $pending]);
        $client->shouldReceive('batchGetItem')->once()->with(['RequestItems' => $pending])
            ->andReturn(['Responses' => [$table => [$marshalled[1]]], 'UnprocessedKeys' => []]);
        $this->swapDynamoDbClient($client);

        $this->assertSame($keys, app(DynamoDbItems::class)->batchGet($keys));
        Sleep::assertSleptTimes(1);
    }

    public function test_batch_get_fails_instead_of_returning_incomplete_results(): void
    {
        Sleep::fake();
        $table = (string) config('aws.dynamodb.table');
        $key = ['PK' => 'EVENT#1', 'SK' => 'MEMBER#student'];
        $pending = [$table => ['Keys' => [(new ItemMarshaller)->marshal($key)], 'ConsistentRead' => true]];
        $client = Mockery::mock(DynamoDbClient::class);
        $client->shouldReceive('batchGetItem')->times(5)->with(['RequestItems' => $pending])
            ->andReturn(['UnprocessedKeys' => $pending]);
        $this->swapDynamoDbClient($client);

        try {
            app(DynamoDbItems::class)->batchGet([$key]);
            $this->fail('An incomplete batch read must fail.');
        } catch (RuntimeException $error) {
            $this->assertSame('DynamoDB batch read could not process all requested keys.', $error->getMessage());
        }

        Sleep::assertSleptTimes(4);
    }

    public function test_empty_batch_does_not_call_dynamodb(): void
    {
        $client = Mockery::mock(DynamoDbClient::class);
        $client->shouldNotReceive('batchGetItem');
        $this->swapDynamoDbClient($client);

        $this->assertSame([], app(DynamoDbItems::class)->batchGet([]));
    }
}
