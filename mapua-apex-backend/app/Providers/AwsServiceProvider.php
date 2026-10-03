<?php

namespace App\Providers;

use App\Aws\AwsClientFactory;
use App\Aws\DynamoDb\DynamoDbItems;
use Aws\DynamoDb\DynamoDbClient;
use Aws\S3\S3Client;
use Aws\Ses\SesClient;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;

class AwsServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(AwsClientFactory::class, function (Application $app): AwsClientFactory {
            return new AwsClientFactory($app['config']->get('aws', []));
        });

        $this->app->singleton(DynamoDbClient::class, function (Application $app): DynamoDbClient {
            return new DynamoDbClient($app->make(AwsClientFactory::class)->clientOptions('dynamodb'));
        });

        $this->app->singleton(DynamoDbItems::class, function (Application $app): DynamoDbItems {
            return new DynamoDbItems($app->make(DynamoDbClient::class));
        });

        $this->app->singleton(S3Client::class, function (Application $app): S3Client {
            return new S3Client($app->make(AwsClientFactory::class)->clientOptions('s3'));
        });

        $this->app->singleton(SesClient::class, function (Application $app): SesClient {
            return new SesClient($app->make(AwsClientFactory::class)->clientOptions('ses'));
        });
    }
}
