<?php

use App\Http\Middleware\ActivityLogMiddleware;
use App\Http\Middleware\AuthenticateCognitoJwt;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\PrefersJsonResponses;
use Illuminate\Http\Request;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->append(PrefersJsonResponses::class);
        $middleware->throttleApi();
        $middleware->alias([
            'cognito.jwt' => AuthenticateCognitoJwt::class,
            'activity.log' => ActivityLogMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => true,
        );
    })->create();

// Master monorepo env: like the Vite frontend, this app reads the shared .env at
// the repository root instead of its own copy. Only switch when that file exists so
// containers that ship just this folder (env vars injected by the platform, no root
// .env) keep booting with an empty environment file rather than a missing-path error.
$masterEnvPath = dirname(__DIR__, 2);

if (is_file($masterEnvPath.'/.env')) {
    $app->useEnvironmentPath($masterEnvPath);
}

return $app;
