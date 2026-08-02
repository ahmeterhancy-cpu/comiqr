<?php

namespace App\Providers;

use App\AI\AiProvider;
use App\AI\AnthropicProvider;
use App\AI\DeepSeekProvider;
use App\AI\NullAiProvider;
use App\AI\VisionProvider;
use App\Events\OrderPlaced;
use App\Listeners\PrintOrderTicket;
use App\Listeners\PushOrderToIntegrations;
use App\Support\Tenancy\TenantManager;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
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
        $this->app->singleton(AiProvider::class, fn () => $this->makeAiProvider(config('ai.provider')));

        // Vision provider — menu photo-import only. DeepSeek is text-only, so this is
        // Anthropic when its key is set; otherwise a null provider (import returns 503).
        $this->app->singleton(VisionProvider::class, function () {
            $provider = $this->makeAiProvider(config('ai.vision'));

            return $provider instanceof VisionProvider ? $provider : new NullAiProvider;
        });
    }

    /** Build the configured text provider, or the null provider when unkeyed. */
    protected function makeAiProvider(?string $provider): AiProvider
    {
        if ($provider === 'deepseek' && config('ai.deepseek.key')) {
            return new DeepSeekProvider(
                config('ai.deepseek.key'),
                config('ai.deepseek.model'),
                config('ai.deepseek.base_url'),
                (int) config('ai.deepseek.max_tokens', 1024),
            );
        }

        if ($provider === 'anthropic' && config('ai.anthropic.key')) {
            return new AnthropicProvider(
                config('ai.anthropic.key'),
                config('ai.anthropic.model'),
                (int) config('ai.anthropic.max_tokens', 1024),
            );
        }

        return new NullAiProvider;
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // A1: never run production with debug on — it leaks stack traces + config.
        if ($this->app->isProduction() && config('app.debug')) {
            Log::critical('APP_DEBUG is enabled in production — disable it immediately (config/env leak risk).');
        }

        $this->configureRateLimiters();

        // OrderPlaced listeners are NOT registered here: Laravel auto-discovers
        // everything in app/Listeners, so an explicit Event::listen would bind them
        // a second time and every order would be pushed to the tenant's external
        // integrations twice. See PushOrderToIntegrations and PrintOrderTicket.

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
        RateLimiter::for('api', function (Request $request) {
            // Public menu reads are server-rendered, so every diner's request reaches
            // the API from the SAME (Next server) IP — an IP-keyed limit would throttle
            // the whole customer base together and show diners a rate-limit error on a
            // busy venue. Give menu GETs a generous per-tenant budget instead (the menu
            // is a cacheable public read; no venue can starve another).
            if ($request->isMethod('GET') && $request->is('v1/menu', 'v1/menu/*')) {
                return Limit::perMinute(600)
                    ->by($request->query('tenant') ?: $request->route('qrToken') ?: $request->header('X-Tenant') ?: $request->ip());
            }

            // Media are public, cacheable static assets — a single menu page pulls
            // dozens of images at once (logo + covers + every product photo), so a
            // 120/min budget 429s the whole page. Give media GETs a wide ceiling.
            if ($request->isMethod('GET') && $request->is('v1/media/*')) {
                return Limit::perMinute(3000)->by($request->ip());
            }

            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(20)->by($request->ip()),
        ]);

        RateLimiter::for('onboarding', fn (Request $request) => Limit::perHour(10)->by($request->ip()));
    }
}
