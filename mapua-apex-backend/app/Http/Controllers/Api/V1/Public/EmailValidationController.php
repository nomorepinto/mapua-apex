<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class EmailValidationController extends Controller
{
    /**
     * Mailboxes accepted for account and proponent emails. Anything outside
     * this allow-list is rejected locally so no API credit is spent.
     */
    private const ALLOWED_DOMAINS = ['mymail.mapua.edu.ph', 'mapua.edu.ph', 'gmail.com'];

    /**
     * GET /api/v1/public/validate-email?email=...
     *
     * Proxies EmailDetective so the API key stays server-side. Returns a
     * stable envelope: state = valid | invalid | domain_not_allowed | unavailable.
     * Upstream failures surface as 200 + "unavailable" so callers can fail open.
     */
    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
        ]);

        $email = strtolower(trim($validated['email']));
        $domain = substr($email, (int) strrpos($email, '@') + 1);

        if (! in_array($domain, self::ALLOWED_DOMAINS, true)) {
            return $this->envelope(['state' => 'domain_not_allowed']);
        }

        $apiKey = (string) config('services.emaildetective.api_key');
        if ($apiKey === '') {
            return $this->envelope(['state' => 'unavailable']);
        }

        $key = 'emailcheck:'.sha1($email);
        $cached = Cache::has($key);
        $result = Cache::get($key);

        if ($result === null) {
            $result = $this->lookup($email, $apiKey);

            // Only conclusive results are cached; transient outages must not
            // lock a mailbox into "unavailable" for the full cache window.
            if ($result['state'] !== 'unavailable') {
                Cache::put($key, $result, now()->addDay());
            }
        }

        return $this->envelope($result, $cached);
    }

    /**
     * @return array{state: string, score?: int, did_you_mean?: string|null}
     */
    private function lookup(string $email, string $apiKey): array
    {
        $baseUrl = rtrim((string) config('services.emaildetective.base_url'), '/');

        try {
            $response = Http::withToken($apiKey)
                ->connectTimeout(3)
                ->timeout(8)
                ->retry(1, 200, throw: false)
                ->get($baseUrl.'/emails/'.rawurlencode($email));
        } catch (\Throwable) {
            return ['state' => 'unavailable'];
        }

        $payload = $response->json();

        if (! $response->successful() || ! is_array($payload)) {
            return ['state' => 'unavailable'];
        }

        // EmailDetective echoes the queried address back as did_you_mean when
        // there is no correction to suggest; only report a real suggestion.
        $didYouMean = isset($payload['did_you_mean']) && is_string($payload['did_you_mean'])
            && $payload['did_you_mean'] !== ''
            && strtolower($payload['did_you_mean']) !== $email
            ? $payload['did_you_mean']
            : null;

        return [
            'state' => ($payload['valid_email'] ?? false) ? 'valid' : 'invalid',
            'score' => (int) ($payload['score'] ?? 0),
            'did_you_mean' => $didYouMean,
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     */
    private function envelope(array $result, bool $cached = false): JsonResponse
    {
        return response()->json($result + ['cached' => $cached]);
    }
}
