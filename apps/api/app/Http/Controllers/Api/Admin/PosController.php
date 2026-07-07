<?php

namespace App\Http\Controllers\Api\Admin;

use App\Events\OrderPlaced;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Branch;
use App\Models\LoyaltyAccount;
use App\Models\Order;
use App\Models\Table;
use App\Models\TableSession;
use App\Services\LoyaltyService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Support\Restaurant\RestaurantSettings;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Staff POS (Faz 3 — ultra POS): a waiter/cashier builds an order for a guest —
 * dine-in on a table, or a counter/takeaway order — recalls open tabs, adds or
 * voids lines, applies a discount, and settles it (cash/card, split, or charged
 * to a room folio). Reuses OrderService + PaymentService; POS orders are tagged
 * source = 'pos' and broadcast to the KDS like any other.
 */
class PosController extends Controller
{
    private const ITEM_RULES = [
        'items' => ['required', 'array', 'min:1'],
        'items.*.product_id' => ['required', 'integer'],
        'items.*.variant_id' => ['nullable', 'integer'],
        'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
        'items.*.modifiers' => ['nullable', 'array'],
        'items.*.modifiers.*' => ['integer'],
        'items.*.note' => ['nullable', 'string', 'max:200'],
    ];

    public function __construct(
        protected OrderService $orders,
        protected PaymentService $payments,
    ) {}

    /** GET /admin/pos/orders — recall open tabs (or today's) to add to / settle. */
    public function orders(Request $request): JsonResponse
    {
        $scope = $request->query('scope', 'open');
        $branchId = $request->query('branch_id');

        $query = Order::query()
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->with(['items.product', 'tableSession.table.diningArea', 'payments'])
            ->latest('placed_at')
            ->limit(100);

        if ($scope === 'today') {
            $tz = app(TenantManager::class)->get()?->timezone ?? config('app.timezone');
            $query->whereDate('placed_at', now($tz)->toDateString());
        } else {
            $query->where('status', '!=', 'cancelled')->where('payment_status', '!=', 'paid');
        }

        $orders = $query->get()->map(function (Order $order) use ($request) {
            $table = $order->tableSession?->table;

            return (new OrderResource($order))->toArray($request) + [
                'table_code' => $table?->code,
                'area_type' => $table?->diningArea?->type,
            ];
        });

        return response()->json(['data' => $orders]);
    }

    /** POST /admin/pos/orders — create a dine-in (table) or takeaway order. */
    public function order(Request $request): JsonResponse
    {
        $data = $request->validate([
            'table_id' => ['nullable', Rule::exists('tables', 'id')],
            'branch_id' => ['nullable', Rule::exists('branches', 'id')],
            'note' => ['nullable', 'string', 'max:500'],
        ] + self::ITEM_RULES);

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

        return response()->json(['data' => new OrderResource($order->load('items.product'))], 201);
    }

    /** POST /admin/pos/orders/{order}/items — add another round to an open tab. */
    public function addItems(Request $request, string $order): JsonResponse
    {
        $data = $request->validate(self::ITEM_RULES);

        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Ödenmiş siparişe ürün eklenemez.');

        // No OrderPlaced re-dispatch (would ring the KDS as a brand-new order, like
        // the customer add-items path avoids); the KDS poll picks up the new round.
        $this->orders->addItems($model, $data['items']);

        return response()->json(['data' => new OrderResource($model->fresh('items.product'))]);
    }

    /** POST /admin/pos/orders/{order}/items/{item}/void — remove a line (unpaid). */
    public function voidItem(string $order, string $item): JsonResponse
    {
        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Ödenmiş siparişten ürün çıkarılamaz.');

        $line = $model->items()->findOrFail($item);
        $line->update(['status' => 'cancelled', 'line_total' => 0]);

        $model->recalculateTotals();
        // A now-oversized discount (bigger than the shrunken subtotal) is clamped.
        if ((float) $model->discount_total > (float) $model->subtotal) {
            $model->update(['discount_total' => $model->subtotal]);
            $model->recalculateTotals();
        }
        $model->refreshStatusFromItems();
        $this->payments->reconcile($model); // a partial payment may now cover the smaller total

        return response()->json(['data' => new OrderResource($model->fresh('items.product'))]);
    }

    /** POST /admin/pos/orders/{order}/items/{item}/discount — comp/discount one line. */
    public function lineDiscount(Request $request, string $order, string $item): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['percent', 'amount'])],
            'value' => ['required', 'numeric', 'min:0'],
        ]);

        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Ödenmiş siparişte satır indirimi yapılamaz.');

        $line = $model->items()->where('status', '!=', 'cancelled')->findOrFail($item);
        $gross = round((float) $line->unit_price * (int) $line->quantity, 2);
        $discount = $data['type'] === 'percent'
            ? round($gross * min(100, (float) $data['value']) / 100, 2)
            : (float) $data['value'];
        $discount = max(0, min($discount, $gross)); // 0..gross

        $line->update(['discount_total' => $discount, 'line_total' => round($gross - $discount, 2)]);

        $model->recalculateTotals();
        // A now-oversized order-level discount (bigger than the shrunken subtotal) is clamped.
        if ((float) $model->discount_total > (float) $model->subtotal) {
            $model->update(['discount_total' => $model->subtotal]);
            $model->recalculateTotals();
        }
        $this->payments->reconcile($model);

        return response()->json(['data' => new OrderResource($model->fresh('items.product'))]);
    }

    /** POST /admin/pos/orders/{order}/discount — manual order discount (unpaid). */
    public function discount(Request $request, string $order): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['percent', 'amount'])],
            'value' => ['required', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:120'],
        ]);

        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Ödenmiş siparişe indirim uygulanamaz.');

        $subtotal = (float) $model->subtotal;
        $amount = $data['type'] === 'percent'
            ? round($subtotal * min(100, (float) $data['value']) / 100, 2)
            : (float) $data['value'];
        $amount = max(0, min($amount, $subtotal)); // never below zero, never over subtotal

        // Tag manual discounts so a later happy-hour recompute won't erase them;
        // clearing the discount (0) hands control back to the automatic rules.
        $model->update([
            'discount_total' => $amount,
            'discount_source' => $amount > 0 ? 'manual' : null,
        ]);
        $model->recalculateTotals();
        $this->payments->reconcile($model); // a partial payment may now cover the discounted total

        return response()->json(['data' => new OrderResource($model->fresh('items.product'))]);
    }

    /** POST /admin/pos/orders/{order}/charge-to-room — defer to a folio (hotel/beach). */
    public function chargeRoom(string $order): JsonResponse
    {
        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Ödenmiş sipariş odaya yazılamaz.');

        $tenant = app(TenantManager::class)->get();
        abort_unless(
            RestaurantSettings::foliosEnabled($tenant?->settings_json ?? []),
            422,
            'Oda/şezlong folyosu bu işletmede kapalı.',
        );

        $model->update(['charged_to_room' => true]);

        return response()->json(['data' => new OrderResource($model->fresh('items.product'))]);
    }

    /** POST /admin/pos/orders/{order}/pay — settle at the counter (cash | card, split). */
    public function pay(Request $request, string $order): JsonResponse
    {
        $data = $request->validate([
            'gateway' => ['nullable', Rule::in(['cash', 'card'])],
            'amount' => ['nullable', 'numeric', 'min:0.01'], // partial → bill split
            'tip' => ['nullable', 'numeric', 'min:0'],
        ]);

        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Sipariş zaten ödendi.');

        $this->payments->initiate(
            $model,
            $data['gateway'] ?? 'cash',
            (float) ($data['tip'] ?? 0),
            isset($data['amount']) ? (float) $data['amount'] : null,
        );

        $fresh = $model->fresh('items.product');

        return response()->json([
            'data' => new OrderResource($fresh),
            'meta' => ['outstanding' => $this->payments->outstandingFor($fresh)],
        ]);
    }

    /** POST /admin/pos/orders/{order}/refund — return collected money (cash|card). */
    public function refund(Request $request, string $order): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'gateway' => ['nullable', Rule::in(['cash', 'card'])],
            'reason' => ['nullable', 'string', 'max:120'],
        ]);

        $model = Order::findOrFail($order);
        $gateway = $data['gateway'] ?? 'cash';
        abort_if($this->payments->collectedVia($model, $gateway) <= 0, 422, 'Bu ödeme türünde iade edilecek tutar yok.');

        $this->payments->refund($model, (float) $data['amount'], $gateway, $data['reason'] ?? null);

        return response()->json(['data' => new OrderResource($model->fresh('items.product'))]);
    }

    /** POST /admin/pos/orders/{order}/redeem — pay part of the bill with loyalty points. */
    public function redeem(Request $request, string $order): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'max:32'],
            'points' => ['required', 'integer', 'min:1'],
        ]);

        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Sipariş zaten ödendi.');

        $customer = app(LoyaltyService::class)->identify(['phone' => $data['phone']]);
        abort_unless($customer, 422, 'Müşteri bulunamadı.');

        $account = LoyaltyAccount::where('customer_id', $customer->id)->first();
        abort_unless($account && $account->points_balance > 0, 422, 'Kullanılabilir puan yok.');

        if (! $model->customer_id) {
            $model->update(['customer_id' => $customer->id]); // link so the sale also earns
        }

        $result = $this->payments->redeemPoints($model, $account, (int) $data['points']);
        abort_if($result['points'] <= 0, 422, 'Puan uygulanamadı.');

        return response()->json([
            'data' => new OrderResource($model->fresh('items.product')),
            'meta' => ['redeemed_points' => $result['points'], 'balance' => (int) $account->fresh()->points_balance],
        ]);
    }

    /** POST /admin/pos/orders/{order}/service-charge — auto-gratuity as a % of the subtotal. */
    public function serviceCharge(Request $request, string $order): JsonResponse
    {
        $data = $request->validate([
            'percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $model = Order::findOrFail($order);
        abort_if($model->payment_status === 'paid', 422, 'Ödenmiş siparişe servis ücreti eklenemez.');

        // Stored in tax_total (already summed into grand_total by recalculateTotals).
        $model->update(['tax_total' => round((float) $model->subtotal * (float) $data['percent'] / 100, 2)]);
        $model->recalculateTotals();
        $this->payments->reconcile($model);

        return response()->json(['data' => new OrderResource($model->fresh('items.product'))]);
    }
}
