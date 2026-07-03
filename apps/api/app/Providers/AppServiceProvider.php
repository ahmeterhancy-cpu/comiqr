<?php

namespace App\Providers;

use App\Events\OrderPlaced;
use App\Listeners\PushOrderToIntegrations;
use App\Support\Tenancy\TenantManager;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
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

        // Text AI provider (docs/04 §4.7) — Anthropic when a key is set, else null.
        $this->app->singleton(\App\AI\AiProvider::class, function () {
            $key = config('ai.anthropic.key');

            return $key
                ? new \App\AI\AnthropicProvider($key, config('ai.anthropic.model'), (int) config('ai.anthropic.max_tokens', 1024))
                : new \App\AI\NullAiProvider;
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiters();

        // Mirror placed orders to the tenant's external systems (POS/ERP/delivery).
        Event::listen(OrderPlaced::class, PushOrderToIntegrations::class);

        // Reverb WebSocket channel auth for the token SPA (M6/M10). The SPA hits
        // /v1/broadcasting/auth with its bearer token; channels.php authorizes.
        Broadcast::routes(['prefix' => 'v1', 'middleware' => ['auth:sanctum']]);
        require base_path('routes/channels.php');
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
