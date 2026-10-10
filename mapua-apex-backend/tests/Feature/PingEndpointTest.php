<?php

namespace Tests\Feature;

use Tests\TestCase;

class PingEndpointTest extends TestCase
{
    public function test_returns_ok_without_authentication(): void
    {
        $response = $this->getJson('/api/v1/ping');

        $response->assertOk()
            ->assertJsonPath('ok', true);
    }
}
