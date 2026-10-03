<?php

namespace Tests\Unit\Aws;

use App\Aws\AwsClientFactory;
use PHPUnit\Framework\TestCase;

class AwsClientFactoryTest extends TestCase
{
    public function test_builds_explicit_credentials_and_dynamodb_endpoint(): void
    {
        $factory = new AwsClientFactory([
            'key' => 'AKIAEXAMPLE',
            'secret' => 'secret-example',
            'region' => 'ap-southeast-1',
            'dynamodb' => [
                'endpoint' => 'http://localhost:8000',
            ],
        ]);

        $options = $factory->clientOptions('dynamodb');

        $this->assertSame('latest', $options['version']);
        $this->assertSame('ap-southeast-1', $options['region']);
        $this->assertSame([
            'key' => 'AKIAEXAMPLE',
            'secret' => 'secret-example',
        ], $options['credentials']);
        $this->assertSame('http://localhost:8000', $options['endpoint']);
    }

    public function test_omits_credentials_when_keys_are_empty(): void
    {
        $factory = new AwsClientFactory([
            'key' => '',
            'secret' => '',
            'region' => 'us-east-1',
            'dynamodb' => [],
        ]);

        $options = $factory->clientOptions('dynamodb');

        $this->assertArrayNotHasKey('credentials', $options);
        $this->assertArrayNotHasKey('endpoint', $options);
    }

    public function test_uses_service_specific_region_over_default_region(): void
    {
        $factory = new AwsClientFactory([
            'region' => 'us-east-1',
            's3' => [
                'region' => 'ap-southeast-1',
            ],
        ]);

        $options = $factory->clientOptions('s3');

        $this->assertSame('ap-southeast-1', $options['region']);
    }

    public function test_enables_path_style_endpoint_for_s3(): void
    {
        $factory = new AwsClientFactory([
            'region' => 'us-east-1',
            's3' => [
                'use_path_style_endpoint' => true,
            ],
        ]);

        $options = $factory->clientOptions('s3');

        $this->assertTrue($options['use_path_style_endpoint']);
    }
}
