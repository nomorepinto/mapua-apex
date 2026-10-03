<?php

namespace App\Aws;

final class AwsClientFactory
{
    /**
     * @param  array<string, mixed>  $aws
     */
    public function __construct(private readonly array $aws) {}

    /**
     * @return array<string, mixed>
     */
    public function clientOptions(string $service): array
    {
        $serviceConfig = $this->serviceConfig($service);

        $options = [
            'version' => 'latest',
            'region' => $this->stringOption($serviceConfig, 'region')
                ?? $this->stringOption($this->aws, 'region')
                ?? 'us-east-1',
        ];

        $key = $this->stringOption($serviceConfig, 'key') ?? $this->stringOption($this->aws, 'key');
        $secret = $this->stringOption($serviceConfig, 'secret') ?? $this->stringOption($this->aws, 'secret');

        if ($key !== null && $secret !== null) {
            $options['credentials'] = [
                'key' => $key,
                'secret' => $secret,
            ];
        }

        $endpoint = $this->stringOption($serviceConfig, 'endpoint')
            ?? $this->stringOption($this->aws, 'endpoint');

        if ($endpoint !== null) {
            $options['endpoint'] = $endpoint;
        }

        if ($this->booleanOption($serviceConfig, 'use_path_style_endpoint')
            || $this->booleanOption($this->aws, 'use_path_style_endpoint')) {
            $options['use_path_style_endpoint'] = true;
        }

        $env = env('APP_ENV', 'production');
        if (in_array($env, ['local', 'testing', 'dev'], true)) {
            $options['http'] = [
                'verify' => false,
            ];
        }

        return $options;
    }

    /**
     * @return array<string, mixed>
     */
    private function serviceConfig(string $service): array
    {
        $config = $this->aws[$service] ?? [];

        return is_array($config) ? $config : [];
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function stringOption(array $config, string $key): ?string
    {
        $value = $config[$key] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function booleanOption(array $config, string $key): bool
    {
        return filter_var($config[$key] ?? false, FILTER_VALIDATE_BOOLEAN);
    }
}
