<?php

namespace App\Providers;

use App\Auth\CognitoJwtVerifier;
use App\Auth\JwksCognitoJwtVerifier;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(CognitoJwtVerifier::class, JwksCognitoJwtVerifier::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $callerKey = function (Request $request): string {
            $token = $request->bearerToken();

            if (is_string($token) && $token !== '') {
                return hash('sha256', $token);
            }

            return (string) $request->ip();
        };

        $limitByCaller = function (Request $request) use ($callerKey): Limit {
            return Limit::perMinute(60)->by($callerKey($request));
        };

        RateLimiter::for('api', $limitByCaller);
        RateLimiter::for('student', $limitByCaller);
        RateLimiter::for('signatory', $limitByCaller);
        RateLimiter::for('admin', $limitByCaller);

        $writeLimit = function (Request $request) use ($callerKey): Limit {
            return Limit::perMinute(10)->by($callerKey($request));
        };

        RateLimiter::for('student-write', $writeLimit);
        RateLimiter::for('signatory-write', $writeLimit);
        RateLimiter::for('admin-write', $writeLimit);
    }
}
