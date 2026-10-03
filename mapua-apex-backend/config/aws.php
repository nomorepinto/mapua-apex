<?php

return [

    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    'endpoint' => env('AWS_ENDPOINT'),
    'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),

    'cognito' => [
        'region' => env('AWS_COGNITO_REGION', env('AWS_DEFAULT_REGION', 'us-east-1')),
        'user_pool_id' => env('AWS_COGNITO_USER_POOL_ID'),
        'client_id' => env('AWS_COGNITO_CLIENT_ID'),
    ],

    'dynamodb' => [
        'region' => env('AWS_DYNAMODB_REGION', env('AWS_DEFAULT_REGION', 'us-east-1')),
        'endpoint' => env('DYNAMODB_ENDPOINT', env('AWS_ENDPOINT')),
        'table' => env('AWS_DYNAMODB_TABLE'),
        'table_prefix' => env('DYNAMODB_TABLE_PREFIX', ''),
    ],

    's3' => [
        'region' => env('AWS_S3_REGION', env('AWS_DEFAULT_REGION', 'us-east-1')),
        'endpoint' => env('AWS_S3_ENDPOINT', env('AWS_ENDPOINT')),
        'bucket' => env('AWS_BUCKET'),
        'pdf_prefix' => env('AWS_S3_PDF_PREFIX', 'pdfs'),
        'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
    ],

    'ses' => [
        'region' => env('AWS_SES_REGION', env('AWS_DEFAULT_REGION', 'us-east-1')),
    ],

];
