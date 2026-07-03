<?php

namespace App\Http\Controllers\Api\Admin;

use App\Events\OrderPlaced;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Branch;
use App\Models\Order;
use App\Models\Table;
use App\Models\TableSession;
use App\Services\OrderService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Staff POS (Faz 3): a waiter/cashier creates an order for a guest — dine-in on
 * a table, or a counter/takeaway order — and settles it in person (cash or card
 * at the counter). Reuses OrderService + PaymentService; orders are tagged
 * source = 'pos' and broadcast to the KDS like any other.
 */
class PosController extends Controller
{
    public function __construct(
        protected OrderService $orders,
        protected PaymentService $payments,
    ) {}

    /** POST /admin/pos/orders — create a dine-in (table) or takeaway order. */
    public function order(Request $request): JsonResponse
    {
        $data = $request->validate([
            'table_id' => ['nullable', Rule::exists('tables', 'id')],
            'branch_id' => ['nullable', Rule::exists('branches', 'id')],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.modifiers' => ['nullable', 'array'],
            'items.*.modifiers.*' => ['integer'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        if (! empty($data['table_id'])) {
            // Table is tenant-scoped by the global scope → foreign tables 404 here.
            $table = Table::findOrFail($data['table_id']);
            $session = TableSession::firstOrCreate(
                ['table_id' => $table->id, 'status' => 'open'],
                ['opened_at' => now()],
            );
            $order = $this->orders->place($table, $session, $data['items'], $data['note'] ?? null);
        } else {
            $branch = ! empty($data['branch_id'])
                ? Branch::findOrFail($data['branch_id'])
                : Branch::query()->where('is_active', true)->orderBy('id')->firstOrFail();
            $order = $this->orders->placeDirect($branch, $data['items'], 'takeaway', [], $data['note'] ?? null);
        }

        $order->update(['source' => 'pos']);
        OrderPlaced::dispatch($order);

        return response()->json(['data' => new OrderResource($order->load('items'))], 201);
    }

    /** POST /admin/pos/orders/{order}/pay — settle at the counter (cash | card). */
    public function pay(Request $request, string $order): JsonResponse
    {
        $data = $request->validate([
            'gateway' => ['nullable', Rule::in(['cash', 'card'])],
            'tip' => ['nullable', 'numeric', 'min:0'],
        ]);

        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Sipariş zaten ödendi.');

        $this->payments->initiate($model, $data['gateway'] ?? 'cash', (float) ($data['tip'] ?? 0));

        return response()->json(['data' => new OrderResource($model->fresh('items'))]);
    }
}
