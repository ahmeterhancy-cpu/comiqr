<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\TenantManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * For authenticated panel/waiter/KDS routes: binds the active tenant to the
 * signed-in user's tenant (docs/04 §4.3). A user can therefore only ever read
 * or write their own tenant's data.
 *
 * Superadmins (tenant_id = null) carry no tenant here; they reach other tenants
 * only through explicit, audited impersonation (superadmin routes), never via
 * the ambient global scope.
 */
class SetTenantFromUser
{
    public function __construct(protected TenantManager $tenants) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->tenant_id !== null) {
            if (! $user->tenant) {
                abort(403, 'Tenant unavailable.');
            }

            if ($user->tenant->status === 'suspended') {
                abort(403, 'Tenant suspended.');
            }

            $this->tenants->set($user->tenant);
            app()->setLocale($request->query('locale', $user->tenant->locale_default ?? config('app.locale')));
        }

        return $next($request);
    }
}
