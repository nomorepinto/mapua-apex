<?php

namespace Tests\Feature\Aws;

use App\Aws\AwsClientFactory;
use Aws\DynamoDb\DynamoDbClient;
use Aws\S3\S3Client;
use Aws\Ses\SesClient;
use Tests\TestCase;

class AwsServiceProviderTest extends TestCase
{
    public function test_registers_aws_sdk_clients_as_singletons(): void
    {
        $this->assertSame(
            $this->app->make(DynamoDbClient::class),
            $this->app->make(DynamoDbClient::class),
        );
        $this->assertSame(
            $this->app->make(S3Client::class),
            $this->app->make(S3Client::class),
        );
        $this->assertSame(
            $this->app->make(SesClient::class),
            $this->app->make(SesClient::class),
        );
    }

    public function test_resolves_client_factory_from_aws_config(): void
    {
        $factory = $this->app->make(AwsClientFactory::class);

        $options = $factory->clientOptions('dynamodb');

        $this->assertSame('latest', $options['version']);
        $this->assertArrayHasKey('region', $options);
    }
}
