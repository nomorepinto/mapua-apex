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
    | Campus-wide desks. There is one OSAAR and one CDM; change the person's
    | name in place (PUT /signatories) rather than minting a new uuid.
    */
    'signatories' => [
        'osaar_id' => env('OSAAR_SIGNATORY_ID', ''),
        'cdm_id' => env('CDM_SIGNATORY_ID', ''),
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

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
