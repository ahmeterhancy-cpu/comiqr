<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * B5: attaches a per-request correlation id to the log context so structured
 * (JSON) logs can be traced across a single request; tenant_id / user_id are
 * added later by SetTenantFromUser once resolved. The id is echoed back as
 * X-Request-Id for client-side correlation.
 */
class LogContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->headers->get('X-Request-Id') ?: (string) Str::uuid();
        Log::withContext(['request_id' => $id]);

        $response = $next($request);
        $response->headers->set('X-Request-Id', $id);

        return $response;
    }
}
