<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Table;
use App\Models\TableSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Order pricing & creation (M4, docs/04 §4.5). Money is computed here from the
 * current product/variant/modifier prices — the client only sends what was
 * chosen (product, variant, modifier ids, quantity, note), never prices.
 */
class OrderService
{
    public function __construct(protected StockService $stock) {}

    /**
     * @param  array<int,array{product_id:int,variant_id?:int|null,quantity:int,modifiers?:array<int,int>,note?:string}>  $items
     */
    public function place(Table $table, TableSession $session, array $items, ?string $note = null, ?\App\Models\Customer $customer = null): Order
    {
        return DB::transaction(function () use ($table, $session, $items, $note, $customer) {
            $order = Order::create([
                'branch_id' => $table->branch_id,
                'table_session_id' => $session->id,
                'customer_id' => $customer?->id,
                'source' => 'qr',
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'note' => $note,
                'placed_at' => now(),
            ]);

            $this->addLines($order, $items);
            $order->recalculateTotals();
            $this->applyHappyHour($order);

            // Deduct ingredient stock via each item's recipe (Faz 2, docs/03 §3.6).
            $this->stock->deductForOrder($order);

            return $order->load('items');
        });
    }

    /**
     * Place a package-service order not bound to a table (marketplace/menu web
     * checkout, M20). type = delivery|takeaway; delivery carries a contact phone
     * + address. Pricing/stock work exactly like a dine-in order.
     *
     * @param  array<int,array<string,mixed>>  $items
     * @param  array{name?:string,phone?:string,address?:string}  $contact
     */
    public function placeDirect(\App\Models\Branch $branch, array $items, string $type, array $contact = [], ?string $note = null, ?\App\Models\Customer $customer = null, float $deliveryFee = 0): Order
    {
        return DB::transaction(function () use ($branch, $items, $type, $contact, $note, $customer, $deliveryFee) {
            $order = Order::create([
                'branch_id' => $branch->id,
                'table_session_id' => null,
                'customer_id' => $customer?->id,
                'source' => 'web',
                'type' => $type,
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'note' => $note,
                'contact_phone' => $contact['phone'] ?? null,
                'address' => $type === 'delivery' ? ($contact['address'] ?? null) : null,
                'delivery_fee' => $type === 'delivery' ? $deliveryFee : 0,
                'placed_at' => now(),
            ]);

            $this->addLines($order, $items);
            $order->recalculateTotals();
            $this->applyHappyHour($order);
            $this->stock->deductForOrder($order);

            return $order->load('items');
        });
    }

    /**
     * @param  array<int,array<string,mixed>>  $items
     */
    public function addItems(Order $order, array $items): Order
    {
        DB::transaction(function () use ($order, $items) {
            $this->addLines($order, $items);
            $order->recalculateTotals();
            $this->applyHappyHour($order); // re-scale the discount to the grown order
        });

        return $order->load('items');
    }

    /**
     * Apply the tenant's happy-hour discount (bar vertical, Faz 3) as a server
     * authoritative order discount when an order is placed within the window.
     * Applied at placement only; a later coupon (applyCoupon) replaces it.
     */
    protected function applyHappyHour(Order $order): void
    {
        // Never override a cashier's manual POS discount when the tab grows.
        if ($order->discount_source === 'manual') {
            return;
        }

        $tenant = app(\App\Support\Tenancy\TenantManager::class)->get();
        $percent = \App\Support\Restaurant\HappyHour::percent($tenant?->settings_json, null, $tenant?->timezone);
        if ($percent <= 0) {
            return;
        }

        // Keep whichever discount is larger — a coupon set earlier must not be
        // reduced, and the happy-hour amount scales up as the order grows.
        $discount = max((float) $order->discount_total, round((float) $order->subtotal * $percent / 100, 2));
        if ($discount <= 0) {
            return;
        }

        $order->update(['discount_total' => $discount]);
        $order->recalculateTotals();
    }

    /**
     * @param  array<int,array<string,mixed>>  $items
     */
    protected function addLines(Order $order, array $items): void
    {
        foreach ($items as $line) {
            $product = Product::where('is_active', true)->find($line['product_id']);
            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => ["Product {$line['product_id']} is unavailable."],
                ]);
            }

            $variant = null;
            if (! empty($line['variant_id'])) {
                $variant = ProductVariant::where('product_id', $product->id)->find($line['variant_id']);
                if (! $variant) {
                    throw ValidationException::withMessages(['items' => ['Invalid variant for product.']]);
                }
            }

            $modifiers = $this->resolveModifiers($product, $line['modifiers'] ?? []);

            // Category promotion discounts the item (base price + variant), matching
            // the discounted menu price. Modifiers/extras are charged in full.
            $itemPrice = (float) $product->price + (float) ($variant->price_delta ?? 0);
            $promoPct = $product->category?->promoPercent() ?? 0.0;
            if ($promoPct > 0) {
                $itemPrice = round($itemPrice * (1 - $promoPct / 100), 2);
            }

            $unitPrice = $itemPrice + array_sum(array_column($modifiers, 'price_delta'));

            $quantity = max(1, (int) ($line['quantity'] ?? 1));

            $order->items()->create([
                'product_id' => $product->id,
                'variant_id' => $variant?->id,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'modifiers_json' => $modifiers,
                'line_total' => $unitPrice * $quantity,
                'status' => 'pending',
                'note' => $line['note'] ?? null,
            ]);
        }
    }

    /**
     * Validate the chosen modifier ids against the product's own modifier groups
     * and return a priced snapshot. Server-authoritative (docs/05 §5.2):
     *   - every id must belong to a group attached to this product,
     *   - per-group selections must satisfy min/required and not exceed max_select.
     * Selecting a modifier from another product/tenant's group is rejected.
     *
     * @param  array<int,int>  $ids
     * @return array<int,array{id:int,name:string,price_delta:float}>
     */
    protected function resolveModifiers(Product $product, array $ids): array
    {
        $product->loadMissing('modifierGroups.modifiers');
        $groups = $product->modifierGroups;

        // Fast index: modifier id => [modifier, owning group].
        $allowed = [];
        foreach ($groups as $group) {
            foreach ($group->modifiers as $modifier) {
                $allowed[$modifier->id] = ['modifier' => $modifier, 'group' => $group];
            }
        }

        $ids = array_values(array_unique(array_map('intval', $ids)));

        // Reject any id that isn't an option of one of this product's groups.
        foreach ($ids as $id) {
            if (! isset($allowed[$id])) {
                throw ValidationException::withMessages([
                    'items' => ['Invalid modifier for product.'],
                ]);
            }
        }

        // Enforce each group's selection bounds.
        $perGroup = [];
        foreach ($ids as $id) {
            $groupId = $allowed[$id]['group']->id;
            $perGroup[$groupId] = ($perGroup[$groupId] ?? 0) + 1;
        }
        foreach ($groups as $group) {
            $count = $perGroup[$group->id] ?? 0;
            $min = $group->is_required ? max(1, $group->min_select) : $group->min_select;

            if ($count < $min) {
                throw ValidationException::withMessages([
                    'items' => ["Select at least {$min} option(s) from {$group->name}."],
                ]);
            }
            if ($group->max_select > 0 && $count > $group->max_select) {
                throw ValidationException::withMessages([
                    'items' => ["Select at most {$group->max_select} option(s) from {$group->name}."],
                ]);
            }
        }

        // Priced snapshot, preserving the order the guest selected them in.
        return array_map(fn (int $id) => [
            'id' => $allowed[$id]['modifier']->id,
            'name' => $allowed[$id]['modifier']->name,
            'price_delta' => (float) $allowed[$id]['modifier']->price_delta,
        ], $ids);
    }
}
