<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * A4: readiness probe that actually touches the backing services, so a load
 * balancer / uptime monitor can tell a degraded backend (DB or cache down) from
 * a healthy one — unlike the stock /up boot check or the static ping.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [];
        $ok = true;

        try {
            DB::select('select 1');
            $checks['database'] = 'ok';
        } catch (\Throwable) {
            $checks['database'] = 'down';
            $ok = false;
        }

        try {
            Cache::store()->put('health:ping', 1, 5);
            $checks['cache'] = ((int) Cache::store()->get('health:ping')) === 1 ? 'ok' : 'down';
            $ok = $ok && $checks['cache'] === 'ok';
        } catch (\Throwable) {
            $checks['cache'] = 'down';
            $ok = false;
        }

        return response()->json(['status' => $ok ? 'ok' : 'degraded', 'checks' => $checks], $ok ? 200 : 503);
    }
}
