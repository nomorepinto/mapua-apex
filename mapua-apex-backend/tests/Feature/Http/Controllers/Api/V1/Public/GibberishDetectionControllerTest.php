<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Public;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GibberishDetectionControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Pin the service config so the shared root .env never leaks a real key
        // (or a real upstream call) into the suite, and force the flag on so the
        // detection paths are exercised regardless of the local .env default.
        config([
            'services.gibberish.enabled' => true,
            'services.gibberish.api_key' => 'test-key',
            'services.gibberish.base_url' => 'https://gibberish.test',
        ]);
        Cache::clear();
    }

    public function test_disabled_flag_short_circuits_without_calling_the_api(): void
    {
        config(['services.gibberish.enabled' => false]);
        Http::fake();

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'asdf qwerty zzz'])
            ->assertOk()
            ->assertJsonPath('is_gibberish', false);

        Http::assertNothingSent();
    }

    public function test_reports_gibberish_text_as_true(): void
    {
        Http::fake([
            'gibberish.test/api/detect' => Http::response(['is_gibberish' => true]),
        ]);

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'asdfqwerty zxcvb'])
            ->assertOk()
            ->assertJsonPath('is_gibberish', true)
            ->assertJsonPath('cached', false);
    }

    public function test_reports_normal_text_as_false(): void
    {
        Http::fake([
            'gibberish.test/api/detect' => Http::response(['is_gibberish' => false]),
        ]);

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'Tech Week 2026 kickoff'])
            ->assertOk()
            ->assertJsonPath('is_gibberish', false);
    }

    public function test_blank_text_is_rejected_as_a_validation_error(): void
    {
        Http::fake();

        // `required` treats a whitespace-only value as empty, so a blank field
        // never spends a detector call — the frontend also skips blank inputs.
        $this->postJson('/api/v1/public/detect-gibberish', ['text' => '   '])
            ->assertStatus(422);

        Http::assertNothingSent();
    }

    public function test_upstream_failure_fails_open_as_not_gibberish(): void
    {
        Http::fake([
            'gibberish.test/api/detect' => Http::response([], 500),
        ]);

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'some text here'])
            ->assertOk()
            ->assertJsonPath('is_gibberish', false);
    }

    public function test_inconclusive_lookup_is_not_cached_so_a_later_verdict_is_used(): void
    {
        // First lookup hits an outage, the second one succeeds.
        Http::fake([
            'gibberish.test/api/detect' => Http::sequence()
                ->push([], 500)
                ->push(['is_gibberish' => true]),
        ]);

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'asdfqwerty zxcvb'])
            ->assertOk()
            ->assertJsonPath('is_gibberish', false);

        // Detector recovers: the outage must not have pinned this text as clean for
        // the whole cache window, otherwise the check silently stops working for it.
        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'asdfqwerty zxcvb'])
            ->assertOk()
            ->assertJsonPath('is_gibberish', true)
            ->assertJsonPath('cached', false);

        Http::assertSentCount(2);
    }

    public function test_missing_api_key_fails_open_without_calling_the_api(): void
    {
        config(['services.gibberish.api_key' => '']);
        Http::fake();

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'some text here'])
            ->assertOk()
            ->assertJsonPath('is_gibberish', false);

        Http::assertNothingSent();
    }

    public function test_results_are_cached_so_a_second_lookup_sends_no_extra_call(): void
    {
        Http::fake([
            'gibberish.test/api/detect' => Http::response(['is_gibberish' => true]),
        ]);

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'asdfqwerty zxcvb'])->assertOk();
        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'asdfqwerty zxcvb'])
            ->assertOk()
            ->assertJsonPath('cached', true);

        Http::assertSentCount(1);
    }

    public function test_detector_version_bump_invalidates_verdicts_cached_under_old_tuning(): void
    {
        Http::fake([
            'gibberish.test/api/detect' => Http::response(['is_gibberish' => true]),
        ]);

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'teh quick brwn fox'])
            ->assertOk()
            ->assertJsonPath('cached', false);

        // Same text, same stub: still cached under the current tuning.
        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'teh quick brwn fox'])
            ->assertOk()
            ->assertJsonPath('cached', true);

        // Detector gets retuned: the old verdicts must not be served any more.
        config(['services.gibberish.version' => '2']);

        $this->postJson('/api/v1/public/detect-gibberish', ['text' => 'teh quick brwn fox'])
            ->assertOk()
            ->assertJsonPath('cached', false);

        Http::assertSentCount(2);
    }

    public function test_requires_a_text_param(): void
    {
        $this->postJson('/api/v1/public/detect-gibberish', [])
            ->assertStatus(422);
    }
}
