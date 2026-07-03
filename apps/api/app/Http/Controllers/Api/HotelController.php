<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Table;
use App\Models\TableSession;
use App\Services\PaymentService;
use App\Support\Restaurant\RestaurantSettings;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Hotel vertical front-desk surface (Faz 3). Room-service orders that the guest
 * chose to "charge to room" pile up on the room's folio (unpaid, flagged). This
 * controller lists open folios and settles a room at check-out. Tenant-scoped by
 * the `tenant.user` middleware; only room-type dining areas are in scope.
 *
 * A charged-to-room order can only be paid through settle() here (the guest /pay
 * route is blocked for it), so folio orders are always fully `unpaid` — grand
 * total equals the amount owed.
 */
class HotelController extends Controller
{
    public function __construct(
        protected PaymentService $payments,
        protected TenantManager $tenants,
    ) {}

    /** GET /admin/hotel/folio — rooms with open (unpaid, charged-to-room) orders. */
    public function folio(Request $request): JsonResponse
    {
        $this->requireTenant();

        $branchId = $request->integer('branch_id') ?: null;

        $rooms = Table::query()
            ->whereHas('diningArea', fn ($q) => $q->whereIn('type', RestaurantSettings::FOLIO_AREA_TYPES))
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->with('diningArea:id,name,type')
            ->get();

        if ($rooms->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $orders = Order::query()
            ->where('charged_to_room', true)
            ->where('payment_status', 'unpaid')
            ->whereHas('tableSession', fn ($q) => $q->whereIn('table_id', $rooms->pluck('id')))
            ->with(['tableSession:id,table_id', 'items:id,order_id'])
            ->get()
            ->groupBy(fn ($o) => $o->tableSession->table_id);

        $data = $rooms
            ->filter(fn (Table $room) => $orders->has($room->id))
            ->map(function (Table $room) use ($orders) {
                $roomOrders = $orders->get($room->id);

                return [
                    'table_id' => $room->id,
                    'code' => $room->code,
                    'area' => $room->diningArea?->name,
                    'area_type' => $room->diningArea?->type,
                    'order_count' => $roomOrders->count(),
                    'total' => round((float) $roomOrders->sum(fn ($o) => (float) $o->grand_total), 2),
                    'orders' => $roomOrders
                        ->sortBy('placed_at')
                        ->map(fn (Order $o) => [
                            'id' => $o->id,
                            'grand_total' => (float) $o->grand_total,
                            'items_count' => $o->items->count(),
                            'placed_at' => $o->placed_at,
                        ])->values(),
                ];
            })
            ->values();

        return response()->json(['data' => $data]);
    }

    /**
     * POST /admin/hotel/rooms/{table}/settle — check-out: pay off every open
     * folio order on the room (recorded as cash) and close its session. Wrapped
     * in a transaction with a row lock so a double-clicked / retried check-out
     * can't create duplicate cash payments.
     */
    public function settle(string $table): JsonResponse
    {
        $this->requireTenant();

        $room = Table::query()
            ->whereHas('diningArea', fn ($q) => $q->whereIn('type', RestaurantSettings::FOLIO_AREA_TYPES))
            ->findOrFail($table);

        return DB::transaction(function () use ($room) {
            $orders = Order::query()
                ->where('charged_to_room', true)
                ->where('payment_status', 'unpaid')
                ->whereHas('tableSession', fn ($q) => $q->where('table_id', $room->id))
                ->lockForUpdate()
                ->get();

            $settled = 0.0;
            foreach ($orders as $order) {
                $settled += (float) $order->grand_total;
                $this->payments->initiate($order, 'cash');
            }

            // Close each open session only once nothing is still owed on it — a
            // non-folio unpaid order must not be stranded behind a closed session.
            $closed = 0;
            $sessions = TableSession::where('table_id', $room->id)->where('status', 'open')->get();
            foreach ($sessions as $session) {
                $owing = Order::where('table_session_id', $session->id)
                    ->whereIn('payment_status', ['unpaid', 'partially_paid'])
                    ->exists();
                if (! $owing) {
                    $session->update(['status' => 'closed', 'closed_at' => now()]);
                    $closed++;
                }
            }

            return response()->json(['data' => [
                'table_id' => $room->id,
                'settled_count' => $orders->count(),
                'settled_total' => round($settled, 2),
                'sessions_closed' => $closed,
                'sessions_open' => $sessions->count() - $closed,
            ]]);
        });
    }

    /**
     * Guard the tenant-scoped surface. With no active tenant (e.g. a platform
     * superadmin's own token) TenantScope is a no-op and these queries would run
     * across every tenant — refuse rather than leak.
     */
    private function requireTenant(): void
    {
        abort_unless($this->tenants->check(), 403, 'İşletme bağlamı gerekli.');
    }
}
