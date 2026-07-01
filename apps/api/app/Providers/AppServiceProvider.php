<?php

namespace App\Providers;

use App\Support\Tenancy\TenantManager;
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
        // One tenant context per request/job (docs/04 §4.2).
        $this->app->singleton(TenantManager::class);
        $this->app->alias(TenantManager::class, 'tenant');
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiters();
    }

    /**
     * Rate limits (docs/04 §4.9 — every endpoint is rate-limited). Auth surfaces
     * are throttled hard to blunt credential stuffing and onboarding abuse.
     */
    protected function configureRateLimiters(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(20)->by($request->ip()),
        ]);

        RateLimiter::for('onboarding', fn (Request $request) => Limit::perHour(10)->by($request->ip()));
    }
}
