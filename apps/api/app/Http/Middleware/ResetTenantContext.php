<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Clears any tenant carried over from a previous request before this one is
 * handled. The TenantManager is a singleton, so under a persistent runtime
 * (Octane) or across sub-requests in a single test the context would otherwise
 * leak from one request into the next — a cross-tenant hazard. TenantResolver /
 * SetTenantFromUser then establish the correct tenant for this request.
 */
class ResetTenantContext
{
    public function __construct(protected TenantManager $tenants) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->tenants->forget();

        return $next($request);
    }
}
