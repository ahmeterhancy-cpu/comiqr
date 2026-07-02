<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Table;
use App\Models\TableSession;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Table sessions opened from a scanned QR (M3/M4, docs/06 §6.3). Public — the
 * unguessable qr_token authorises the customer to open/join a tab.
 */
class SessionController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    /** POST /sessions/{qrToken}/open — open or join the table's current tab. */
    public function open(Request $request, string $qrToken): JsonResponse
    {
        $data = $request->validate(['guest_count' => ['nullable', 'integer', 'min:1', 'max:50']]);

        $table = Table::withoutTenancy()
            ->where('qr_token', $qrToken)
            ->where('is_active', true)
            ->first();

        abort_if($table === null, 404, 'Table not found.');

        $tenant = Tenant::find($table->tenant_id);
        abort_if($tenant === null || $tenant->status === 'suspended', 404, 'Table not found.');

        $session = $this->tenants->runAs($tenant, function () use ($table, $data) {
            return TableSession::firstOrCreate(
                ['table_id' => $table->id, 'status' => 'open'],
                ['opened_at' => now(), 'guest_count' => $data['guest_count'] ?? null],
            );
        });

        return response()->json([
            'data' => [
                'session_id' => $session->id,
                'table' => ['id' => $table->id, 'code' => $table->code],
                'status' => $session->status,
                'opened_at' => $session->opened_at,
            ],
        ], $session->wasRecentlyCreated ? 201 : 200);
    }
}
