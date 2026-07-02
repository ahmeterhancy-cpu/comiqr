<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderPlaced;
use App\Http\Controllers\Concerns\ResolvesQrToken;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\Table;
use App\Models\TableSession;
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

    public function __construct(protected OrderService $orders) {}

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

        $order = $this->orders->place($table, $session, $data['items'], $data['note'] ?? null);

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
