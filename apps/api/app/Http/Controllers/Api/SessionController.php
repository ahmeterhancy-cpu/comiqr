<?php

namespace App\Http\Controllers\Api;

use App\Events\BillRequested;
use App\Events\WaiterCalled;
use App\Http\Controllers\Concerns\ResolvesQrToken;
use App\Http\Controllers\Controller;
use App\Models\TableSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Table sessions + service calls opened from a scanned QR (M3/M4, docs/06 §6.3).
 * Public — the unguessable qr_token authorises the customer.
 */
class SessionController extends Controller
{
    use ResolvesQrToken;

    /** POST /sessions/{qrToken}/open — open or join the table's current tab. */
    public function open(Request $request, string $qrToken): JsonResponse
    {
        $data = $request->validate(['guest_count' => ['nullable', 'integer', 'min:1', 'max:50']]);
        [$table] = $this->resolveByToken($qrToken);

        $session = TableSession::firstOrCreate(
            ['table_id' => $table->id, 'status' => 'open'],
            ['opened_at' => now(), 'guest_count' => $data['guest_count'] ?? null],
        );

        return response()->json([
            'data' => [
                'session_id' => $session->id,
                'table' => ['id' => $table->id, 'code' => $table->code],
                'status' => $session->status,
                'opened_at' => $session->opened_at,
            ],
        ], $session->wasRecentlyCreated ? 201 : 200);
    }

    /** POST /sessions/{qrToken}/call-waiter → notify the waiter app (Reverb). */
    public function callWaiter(string $qrToken): JsonResponse
    {
        [$table] = $this->resolveByToken($qrToken);
        $this->openSessionFor($table)?->update(['waiter_called_at' => now()]);
        WaiterCalled::dispatch($table->branch_id, $table->id, $table->code);

        return response()->json(['data' => ['called' => true]]);
    }

    /** POST /sessions/{qrToken}/request-bill → notify the waiter app (Reverb). */
    public function requestBill(string $qrToken): JsonResponse
    {
        [$table] = $this->resolveByToken($qrToken);
        $this->openSessionFor($table)?->update(['bill_requested_at' => now()]);
        BillRequested::dispatch($table->branch_id, $table->id, $table->code);

        return response()->json(['data' => ['requested' => true]]);
    }

    /** POST /service/call-waiter — slug menu: resolve the table by the code the customer picked. */
    public function callWaiterByCode(Request $request): JsonResponse
    {
        $table = $this->resolveByCode($request);
        $this->openSessionFor($table)?->update(['waiter_called_at' => now()]);
        WaiterCalled::dispatch($table->branch_id, $table->id, $table->code);

        return response()->json(['data' => ['called' => true, 'table' => $table->code]]);
    }

    /** POST /service/request-bill — slug menu counterpart of callWaiterByCode. */
    public function requestBillByCode(Request $request): JsonResponse
    {
        $table = $this->resolveByCode($request);
        $this->openSessionFor($table)?->update(['bill_requested_at' => now()]);
        BillRequested::dispatch($table->branch_id, $table->id, $table->code);

        return response()->json(['data' => ['requested' => true, 'table' => $table->code]]);
    }

    /**
     * Resolve the active tenant's table from the posted `table` code (tenant set by
     * the `tenant` middleware). 403 when the owner disabled table service.
     */
    private function resolveByCode(Request $request): \App\Models\Table
    {
        $tenant = app(\App\Support\Tenancy\TenantManager::class)->get();
        abort_if($tenant === null, 404, 'Not found.');
        abort_unless(
            \App\Support\Restaurant\RestaurantSettings::allows($tenant->settings_json ?? [], 'allow_call_waiter'),
            403,
            'Masa servisi kapalı.',
        );

        $data = $request->validate(['table' => ['required', 'string', 'max:60']]);

        $table = \App\Models\Table::where('code', $data['table'])
            ->where('is_active', true)
            ->first();

        abort_if($table === null, 404, 'Masa bulunamadı.');

        return $table;
    }

    private function openSessionFor(\App\Models\Table $table): ?TableSession
    {
        return TableSession::firstOrCreate(
            ['table_id' => $table->id, 'status' => 'open'],
            ['opened_at' => now()],
        );
    }
}
