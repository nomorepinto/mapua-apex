<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * POST /api/v1/public/detect-gibberish
 *
 * Proxies the external gibberish detector so the API key stays server-side. The
 * whole feature is gated by config('services.gibberish.enabled'); when the flag is
 * off the endpoint short-circuits to is_gibberish=false so no user is ever blocked.
 * Upstream failures and a missing key also return is_gibberish=false (fail open),
 * mirroring the mailbox-existence proxy's behaviour, but unlike a real verdict that
 * miss is never cached — and it is logged, so a broken detector is not invisible.
 */
class GibberishDetectionController extends Controller
{
    public function detect(Request $request): JsonResponse
    {
        // Feature disabled: answer "not gibberish" without touching validation or
        // the network, so turning the flag off makes the check fully inert.
        if (! config('services.gibberish.enabled')) {
            return $this->envelope(false);
        }

        $validated = $request->validate([
            'text' => ['required', 'string', 'max:20000'],
        ]);

        $text = trim($validated['text']);

        // Obviously empty input is never gibberish — skip the network call.
        if ($text === '') {
            return $this->envelope(false);
        }

        $apiKey = (string) config('services.gibberish.api_key');
        if ($apiKey === '') {
            return $this->envelope(false);
        }

        // The detector version is part of the key so retuning the detector's own
        // thresholds invalidates every previously cached verdict instantly.
        $key = 'gibberish:'.config('services.gibberish.version', '1').':'.sha1($text);
        $cached = Cache::has($key);
        $isGibberish = Cache::get($key);

        if ($isGibberish === null) {
            $verdict = $this->detectUpstream($text, $apiKey);

            // Only conclusive verdicts are cached. An inconclusive lookup (transport
            // error, non-2xx, unreadable body) fails open WITHOUT caching, otherwise a
            // brief detector outage would pin "not gibberish" for the whole window and
            // silently disable the check for every text already looked up while it was down.
            if ($verdict === null) {
                return $this->envelope(false);
            }

            Cache::put($key, $verdict, max(60, (int) config('services.gibberish.cache_ttl', 3600)));
            $isGibberish = $verdict;
        }

        return $this->envelope((bool) $isGibberish, $cached);
    }

    /**
     * Asks the detector about a single string.
     *
     * @return bool|null true/false is a conclusive verdict; null means the detector
     *                   could not be reached or answered sensibly (fail open).
     */
    private function detectUpstream(string $text, string $apiKey): ?bool
    {
        $baseUrl = rtrim((string) config('services.gibberish.base_url'), '/');

        if ($baseUrl === '') {
            return null;
        }

        try {
            $response = Http::withHeaders([
                'X-API-Key' => $apiKey,
                'ngrok-skip-browser-warning' => 'true',
            ])
                ->connectTimeout(3)
                ->timeout(8)
                ->retry(1, 200, throw: false)
                ->post($baseUrl.'/api/detect', ['text' => $text]);
        } catch (\Throwable $exception) {
            // Fail open, but say so: a silently swallowed transport error is
            // indistinguishable from "the detector says this text is fine".
            Log::warning('Gibberish detector request failed.', [
                'reason' => 'transport',
                'error' => $exception->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('Gibberish detector returned an unusable status.', [
                'reason' => 'status',
                'status' => $response->status(),
            ]);

            return null;
        }

        $payload = $response->json();
        if (! is_array($payload) || ! array_key_exists('is_gibberish', $payload)) {
            Log::warning('Gibberish detector response was not parsable.', [
                'reason' => 'payload',
                'body' => substr($response->body(), 0, 200),
            ]);

            return null;
        }

        return $payload['is_gibberish'] === true;
    }

    private function envelope(bool $isGibberish, bool $cached = false): JsonResponse
    {
        return response()->json([
            'is_gibberish' => $isGibberish,
            'cached' => $cached,
        ]);
    }
}
