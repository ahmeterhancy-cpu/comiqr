<?php

namespace App\Http\Middleware;

use App\Support\Plans\PlanGate;
use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gates a route behind a plan feature (M12). Usage: `plan:analytics`. Requires an
 * active tenant (place after tenant.user). Returns 402 when the plan lacks it.
 */
class EnsurePlanFeature
{
    public function __construct(protected TenantManager $tenants) {}

    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $tenant = $this->tenants->get();
        abort_if($tenant === null, 403, 'No active tenant.');

        abort_unless(
            PlanGate::allows($tenant, $feature),
            402,
            "Your plan does not include this feature ({$feature}). Please upgrade.",
        );

        return $next($request);
    }
}
