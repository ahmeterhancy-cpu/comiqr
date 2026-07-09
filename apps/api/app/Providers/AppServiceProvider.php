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

        // Text AI provider (docs/04 §4.7) — DeepSeek or Anthropic by config, else null.
        $this->app->singleton(\App\AI\AiProvider::class, fn () => $this->makeAiProvider(config('ai.provider')));

        // Vision provider — menu photo-import only. DeepSeek is text-only, so this is
        // Anthropic when its key is set; otherwise a null provider (import returns 503).
        $this->app->singleton(\App\AI\VisionProvider::class, function () {
            $provider = $this->makeAiProvider(config('ai.vision'));

            return $provider instanceof \App\AI\VisionProvider ? $provider : new \App\AI\NullAiProvider;
        });
    }

    /** Build the configured text provider, or the null provider when unkeyed. */
    protected function makeAiProvider(?string $provider): \App\AI\AiProvider
    {
        if ($provider === 'deepseek' && config('ai.deepseek.key')) {
            return new \App\AI\DeepSeekProvider(
                config('ai.deepseek.key'),
                config('ai.deepseek.model'),
                config('ai.deepseek.base_url'),
                (int) config('ai.deepseek.max_tokens', 1024),
            );
        }

        if ($provider === 'anthropic' && config('ai.anthropic.key')) {
            return new \App\AI\AnthropicProvider(
                config('ai.anthropic.key'),
                config('ai.anthropic.model'),
                (int) config('ai.anthropic.max_tokens', 1024),
            );
        }

        return new \App\AI\NullAiProvider;
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // A1: never run production with debug on — it leaks stack traces + config.
        if ($this->app->isProduction() && config('app.debug')) {
            \Illuminate\Support\Facades\Log::critical('APP_DEBUG is enabled in production — disable it immediately (config/env leak risk).');
        }

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
