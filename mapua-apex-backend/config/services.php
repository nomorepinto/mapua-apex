<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_SES_REGION', env('AWS_DEFAULT_REGION', 'us-east-1')),
    ],

    /*
    | Arcus companion apps. Links are embedded in the approval email sent to the
    | org_submitter when a proposal is fully approved; the post-evaluation window
    | is the number of days after the event that evaluation stays open.
    */
    'arcus' => [
        'attendance_url' => env('ARCUS_ATTENDANCE_URL', ''),
        'evaluation_url' => env('ARCUS_EVALUATION_URL', ''),
        'post_evaluation_window_days' => env('ARCUS_POST_EVALUATION_WINDOW_DAYS', 3),
        'service_token' => env('ARCUS_SERVICE_TOKEN', ''),
    ],

    /*
    | EmailDetective mailbox checker. Proxied by GET /public/validate-email so the
    | key never reaches the browser; lookups are credit-metered and cached per email.
    */
    'emaildetective' => [
        'base_url' => env('EMAILDETECTIVE_BASE_URL', 'https://api.emaildetective.io'),
        'api_key' => env('EMAILDETECTIVE_API_KEY', ''),
    ],

    /*
    | Gibberish detector. Proxied by POST /public/detect-gibberish so the key never
    | reaches the browser. Gated by GIBBERISH_CHECK_ENABLED (default off): when the
    | flag is false the endpoint short-circuits to is_gibberish=false and blocks no
    | user, so the feature can be switched on for showcases without a code change.
    |
    | Verdicts are cached per exact string. GIBBERISH_DETECTOR_VERSION is part of the
    | cache key: bump it whenever the detector's own thresholds are retuned and every
    | verdict cached under the old tuning is dropped at once, instead of lingering
    | until the TTL expires. GIBBERISH_CACHE_TTL is that window, in seconds.
    */
    'gibberish' => [
        'enabled' => filter_var(env('GIBBERISH_CHECK_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
        'base_url' => env('GIBBERISH_API_URL', ''),
        'api_key' => env('GIBBERISH_API_KEY', ''),
        'version' => (string) env('GIBBERISH_DETECTOR_VERSION', '1'),
        'cache_ttl' => (int) env('GIBBERISH_CACHE_TTL', 3600),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
