<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the active tenant for a request and binds it to {@see TenantManager}
 * (docs/04 §4.2). Resolution order:
 *
 *   1. `X-Tenant` header (tenant slug) — used by native apps / dev / tests.
 *   2. Custom domain — exact match on `tenants.custom_domain`.
 *   3. Subdomain of APP_BASE_DOMAIN — `{slug}.comiqr.com` → slug.
 *
 * Central hosts (CENTRAL_DOMAINS: api/admin/localhost) carry no tenant. If a
 * route guarded by this middleware cannot resolve a tenant, it 404s — tenant
 * data is never served without an explicit, valid tenant.
 */
class TenantResolver
{
    public function __construct(protected TenantManager $tenants) {}

    public function handle(Request $request, Closure $next): Response
    {
        $tenant = $this->resolve($request);

        if ($tenant === null) {
            abort(404, 'Tenant not found.');
        }

        if ($tenant->status === 'suspended') {
            abort(403, 'Tenant suspended.');
        }

        $this->tenants->set($tenant);
        $request->attributes->set('tenant', $tenant);

        // Make locale/currency follow the tenant unless the request overrides it.
        app()->setLocale($request->query('locale', $tenant->locale_default ?? config('app.locale')));

        return $next($request);
    }

    protected function resolve(Request $request): ?Tenant
    {
        if ($slug = $request->header('X-Tenant')) {
            return Tenant::query()->where('slug', $slug)->first();
        }

        $host = strtolower($request->getHost());

        if ($this->isCentralHost($host)) {
            return null;
        }

        if ($tenant = Tenant::query()->where('custom_domain', $host)->first()) {
            return $tenant;
        }

        $slug = $this->subdomainOf($host);

        return $slug ? Tenant::query()->where('slug', $slug)->first() : null;
    }

    protected function isCentralHost(string $host): bool
    {
        $central = collect(explode(',', (string) config('app.central_domains')))
            ->map(fn ($h) => strtolower(trim($h)))
            ->filter();

        return $central->contains($host);
    }

    protected function subdomainOf(string $host): ?string
    {
        $base = strtolower((string) config('app.base_domain'));

        if ($base && str_ends_with($host, '.'.$base)) {
            $sub = substr($host, 0, -1 * (strlen($base) + 1));

            // Only the left-most label is the tenant slug (ignore www).
            $label = explode('.', $sub)[0] ?? '';

            return ($label && $label !== 'www') ? $label : null;
        }

        return null;
    }
}
