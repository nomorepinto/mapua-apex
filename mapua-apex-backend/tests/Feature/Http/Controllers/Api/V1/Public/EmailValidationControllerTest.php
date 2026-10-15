<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Public;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EmailValidationControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Pin the service config so the shared root .env never leaks a real
        // key (or a real upstream call) into the suite.
        config([
            'services.emaildetective.api_key' => 'test-token',
            'services.emaildetective.base_url' => 'https://api.emaildetective.io',
        ]);
        Cache::clear();
    }

    public function test_rejects_email_outside_the_allow_list_without_calling_the_api(): void
    {
        Http::fake();

        $this->getJson('/api/v1/public/validate-email?email=someone@yahoo.com')
            ->assertOk()
            ->assertJsonPath('state', 'domain_not_allowed');

        Http::assertNothingSent();
    }

    public function test_reports_a_deliverable_mailbox_as_valid(): void
    {
        Http::fake([
            'api.emaildetective.io/emails/*' => Http::response([
                'email' => 'juan@mymail.mapua.edu.ph',
                'valid_email' => true,
                'score' => 90,
                'did_you_mean' => 'juan@mymail.mapua.edu.ph',
            ]),
        ]);

        $this->getJson('/api/v1/public/validate-email?email=Juan@MYMAIL.MAPUA.EDU.PH')
            ->assertOk()
            ->assertJsonPath('state', 'valid')
            ->assertJsonPath('score', 90)
            ->assertJsonPath('did_you_mean', null)
            ->assertJsonPath('cached', false);
    }

    public function test_reports_a_missing_mailbox_as_invalid(): void
    {
        Http::fake([
            'api.emaildetective.io/emails/*' => Http::response([
                'valid_email' => false,
                'score' => 10,
                'did_you_mean' => '',
            ]),
        ]);

        $this->getJson('/api/v1/public/validate-email?email=nope@mymail.mapua.edu.ph')
            ->assertOk()
            ->assertJsonPath('state', 'invalid');
    }

    public function test_upstream_failure_fails_open_as_unavailable(): void
    {
        Http::fake([
            'api.emaildetective.io/emails/*' => Http::response([], 401),
        ]);

        $this->getJson('/api/v1/public/validate-email?email=juan@mymail.mapua.edu.ph')
            ->assertOk()
            ->assertJsonPath('state', 'unavailable')
            ->assertJsonPath('cached', false);
    }

    public function test_results_are_cached_so_a_second_lookup_sends_no_extra_call(): void
    {
        Http::fake([
            'api.emaildetective.io/emails/*' => Http::response([
                'valid_email' => true,
                'score' => 80,
                'did_you_mean' => 'juan@mymail.mapua.edu.ph',
            ]),
        ]);

        $this->getJson('/api/v1/public/validate-email?email=juan@mymail.mapua.edu.ph')->assertOk();
        $this->getJson('/api/v1/public/validate-email?email=juan@mymail.mapua.edu.ph')
            ->assertOk()
            ->assertJsonPath('cached', true);

        Http::assertSentCount(1);
    }

    public function test_unavailable_results_are_not_cached(): void
    {
        Http::fake([
            'api.emaildetective.io/emails/*' => Http::response([], 401),
        ]);

        $this->getJson('/api/v1/public/validate-email?email=juan@mymail.mapua.edu.ph')->assertOk();
        $this->getJson('/api/v1/public/validate-email?email=juan@mymail.mapua.edu.ph')->assertOk();

        // Each request must hit upstream exactly once (401 is not retried).
        Http::assertSentCount(2);
    }

    public function test_reports_unavailable_when_no_api_key_is_configured(): void
    {
        config(['services.emaildetective.api_key' => '']);
        Http::fake();

        $this->getJson('/api/v1/public/validate-email?email=juan@mymail.mapua.edu.ph')
            ->assertOk()
            ->assertJsonPath('state', 'unavailable');

        Http::assertNothingSent();
    }

    public function test_requires_a_syntactically_valid_email_param(): void
    {
        $this->getJson('/api/v1/public/validate-email')
            ->assertStatus(422);

        $this->getJson('/api/v1/public/validate-email?email=not-an-email')
            ->assertStatus(422);
    }
}
