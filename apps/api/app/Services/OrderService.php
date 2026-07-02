<?php

namespace App\Services;

use App\Models\Modifier;
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
    /**
     * @param  array<int,array{product_id:int,variant_id?:int|null,quantity:int,modifiers?:array<int,int>,note?:string}>  $items
     */
    public function place(Table $table, TableSession $session, array $items, ?string $note = null): Order
    {
        return DB::transaction(function () use ($table, $session, $items, $note) {
            $order = Order::create([
                'branch_id' => $table->branch_id,
                'table_session_id' => $session->id,
                'source' => 'qr',
                'status' => 'pending',
                'payment_status' => 'unpaid',
                'note' => $note,
                'placed_at' => now(),
            ]);

            $this->addLines($order, $items);
            $order->recalculateTotals();

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
        });

        return $order->load('items');
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

            $unitPrice = (float) $product->price
                + (float) ($variant->price_delta ?? 0)
                + array_sum(array_column($modifiers, 'price_delta'));

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
     * Resolve modifier ids to a priced snapshot, constrained to this tenant's
     * modifier groups (whereHas('group') applies the group's tenant scope).
     *
     * @param  array<int,int>  $ids
     * @return array<int,array{id:int,name:string,price_delta:float}>
     */
    protected function resolveModifiers(Product $product, array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        return Modifier::whereIn('id', $ids)
            ->whereHas('group')
            ->get()
            ->map(fn (Modifier $m) => [
                'id' => $m->id,
                'name' => $m->name,
                'price_delta' => (float) $m->price_delta,
            ])
            ->values()
            ->all();
    }
}
