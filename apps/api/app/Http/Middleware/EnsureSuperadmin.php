<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Platform superadmin gate (docs/04 §4.3). Superadmins have no tenant and operate
 * across tenants; these routes deliberately do NOT run tenant.user.
 */
class EnsureSuperadmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_unless($user && $user->role === Role::Superadmin, 403, 'Superadmin only.');

        return $next($request);
    }
}
