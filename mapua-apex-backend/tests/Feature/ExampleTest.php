<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    public function test_health_endpoint_returns_a_successful_response(): void
    {
        $response = $this->get('/up');

        $response->assertOk();
    }

    public function test_root_url_returns_404(): void
    {
        $response = $this->getJson('/');

        $response->assertNotFound();
    }
}
