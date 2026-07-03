<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderPlaced;
use App\Http\Controllers\Concerns\ResolvesQrToken;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\Table;
use App\Models\TableSession;
use App\Services\LoyaltyService;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer ordering surface (M4, docs/06 §6.3). Everything is nested under the
 * table's qr_token: possession of the token authorises placing and viewing that
 * table's orders. Prices are computed server-side (OrderService).
 */
class OrderController extends Controller
{
    use ResolvesQrToken;

    public function __construct(
        protected OrderService $orders,
        protected LoyaltyService $loyalty,
    ) {}

    /** POST /sessions/{qrToken}/orders — place a new order. */
    public function place(Request $request, string $qrToken): JsonResponse
    {
        [$table, $tenant] = $this->resolveByToken($qrToken);

        // Ordering is a plan feature (M12) — Free is view-only (docs/01 §1.6).
        abort_unless(
            \App\Support\Plans\PlanGate::allows($tenant, 'ordering'),
            402,
            'Ordering is not available on this venue’s plan.',
        );

        $data = $this->validateItems($request);
        $session = $this->openSession($table);

        // Optional loyalty identity (phone) — enables points on payment (M8).
        $customer = $this->loyalty->identify($request->input('customer', []));

        $order = $this->orders->place($table, $session, $data['items'], $data['note'] ?? null, $customer);

        OrderPlaced::dispatch($order);

        return response()->json(['data' => new OrderResource($order)], 201);
    }

    /** GET /sessions/{qrToken}/orders — orders for the table's open session. */
    public function index(string $qrToken): JsonResponse
    {
        [$table] = $this->resolveByToken($qrToken);
        $session = $table->openSession()->first();

        $orders = $session
            ? Order::where('table_session_id', $session->id)->with('items')->latest('placed_at')->get()
            : collect();

        return response()->json(['data' => OrderResource::collection($orders)]);
    }

    /** GET /sessions/{qrToken}/orders/{order} — live status of one order. */
    public function show(string $qrToken, string $order): JsonResponse
    {
        $model = $this->orderForToken($qrToken, $order);

        return response()->json(['data' => new OrderResource($model->load('items'))]);
    }

    /** POST /sessions/{qrToken}/orders/{order}/apply-coupon */
    public function applyCoupon(Request $request, string $qrToken, string $order): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:64']]);
        $model = $this->orderForToken($qrToken, $order);
        abort_if($model->payment_status !== 'unpaid', 422, 'Order can no longer be discounted.');

        $coupon = \App\Models\Coupon::where('code', $data['code'])->first();
        abort_if($coupon === null || ! $coupon->isRedeemable(), 422, 'Invalid or expired coupon.');

        $discount = $coupon->discountFor((float) $model->subtotal);
        abort_if($discount <= 0, 422, 'Coupon conditions not met.');

        $model->update(['discount_total' => $discount]);
        $model->recalculateTotals();
        $coupon->increment('used_count');

        return response()->json(['data' => new OrderResource($model->fresh('items'))]);
    }

    /**
     * POST /sessions/{qrToken}/orders/{order}/charge-to-room — defer payment onto
     * the room's folio (hotel vertical, Faz 3). Only for hotel tenants and only
     * for QRs that belong to a room-type dining area. The order stays unpaid; the
     * front desk settles the folio at check-out.
     */
    public function chargeToRoom(string $qrToken, string $order): JsonResponse
    {
        [$table, $tenant] = $this->resolveByToken($qrToken);

        abort_unless(
            \App\Support\Restaurant\RestaurantSettings::isHotel($tenant->settings_json),
            422,
            'Odaya yansıtma yalnızca otel işletmelerinde kullanılabilir.',
        );

        $table->loadMissing('diningArea');
        abort_unless($table->diningArea?->type === 'room', 422, 'Bu QR bir odaya ait değil.');

        $model = Order::with('tableSession')->find($order);
        abort_if($model === null || $model->tableSession?->table_id !== $table->id, 404, 'Order not found.');
        abort_if($model->payment_status !== 'unpaid', 422, 'Ödenmiş sipariş odaya yansıtılamaz.');

        $model->update(['charged_to_room' => true]);

        return response()->json(['data' => new OrderResource($model->fresh('items'))]);
    }

    /** POST /sessions/{qrToken}/orders/{order}/items — multi-round: add items. */
    public function addItems(Request $request, string $qrToken, string $order): JsonResponse
    {
        $model = $this->orderForToken($qrToken, $order);
        $data = $this->validateItems($request);

        $model = $this->orders->addItems($model, $data['items']);

        return response()->json(['data' => new OrderResource($model)]);
    }

    private function validateItems(Request $request): array
    {
        return $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.modifiers' => ['nullable', 'array'],
            'items.*.modifiers.*' => ['integer'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:500'],
            'customer' => ['nullable', 'array'],
            'customer.phone' => ['nullable', 'string', 'max:32'],
            'customer.name' => ['nullable', 'string', 'max:120'],
        ]);
    }

    private function openSession(Table $table): TableSession
    {
        return TableSession::firstOrCreate(
            ['table_id' => $table->id, 'status' => 'open'],
            ['opened_at' => now()],
        );
    }

    /** Load an order and assert it belongs to the token's table (no id-guessing). */
    private function orderForToken(string $qrToken, string $orderId): Order
    {
        [$table] = $this->resolveByToken($qrToken);

        $order = Order::with('tableSession')->find($orderId);
        abort_if($order === null || $order->tableSession?->table_id !== $table->id, 404, 'Order not found.');

        return $order;
    }
}
