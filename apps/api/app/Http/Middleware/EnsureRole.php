<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Role gate for panel routes (docs/04 §4.3). Usage:
 *
 *   Route::middleware('role:owner,manager')->group(...)
 *
 * Owners implicitly satisfy any manager/waiter/kitchen requirement via the
 * role hierarchy in {@see \App\Enums\Role}.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401);
        }

        $role = $user->role instanceof \App\Enums\Role ? $user->role : \App\Enums\Role::tryFrom((string) $user->role);

        if ($role === null || ! $role->satisfiesAny($roles)) {
            abort(403, 'Insufficient role.');
        }

        return $next($request);
    }
}
