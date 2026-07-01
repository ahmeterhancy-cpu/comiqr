<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Reset tenant context first (no cross-request leak), then rate-limit
        // every API route (docs/04 §4.2, §4.9).
        $middleware->api(prepend: [
            \App\Http\Middleware\ResetTenantContext::class,
            \Illuminate\Routing\Middleware\ThrottleRequests::class.':api',
        ]);

        // Route-level aliases; tenancy is applied per route group in routes/api.php.
        $middleware->alias([
            'tenant' => \App\Http\Middleware\TenantResolver::class,
            'tenant.user' => \App\Http\Middleware\SetTenantFromUser::class,
            'role' => \App\Http\Middleware\EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('v1/*') || $request->expectsJson(),
        );
    })->create();
