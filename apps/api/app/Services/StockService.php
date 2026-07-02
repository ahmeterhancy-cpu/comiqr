<?php

namespace App\Services;

use App\Models\Ingredient;
use App\Models\Order;
use App\Models\StockMovement;
use App\Support\Nutrition\UnitConverter;

/**
 * Ingredient stock deduction (Faz 2, M2/M18, docs/03 §3.6). When an order is
 * placed, each item's recipe consumes ingredient stock proportionally to the
 * ordered quantity; every change is an auditable StockMovement. Ingredients with
 * a null stock_qty are not tracked.
 */
class StockService
{
    /**
     * Deduct stock for a freshly placed order.
     *
     * @return array<int,int> ingredient ids that fell to/below their low-stock threshold
     */
    public function deductForOrder(Order $order): array
    {
        $order->loadMissing('items');
        $lowStock = [];

        foreach ($order->items as $item) {
            $recipe = $item->product?->recipe()->with('items.ingredient')->first();
            if (! $recipe || $recipe->yield_portions < 1) {
                continue;
            }

            foreach ($recipe->items as $recipeItem) {
                $ingredient = $recipeItem->ingredient;
                if (! $ingredient || $ingredient->stock_qty === null) {
                    continue; // not stock-tracked
                }

                $consumed = $this->consumedCanonical($recipeItem->quantity, $recipeItem->unit, $recipe->yield_portions, $item->quantity);
                if ($consumed <= 0) {
                    continue;
                }

                $this->apply($ingredient, -$consumed, 'order', orderItemId: $item->id);

                if ($this->isLow($ingredient->fresh())) {
                    $lowStock[$ingredient->id] = $ingredient->id;
                }
            }
        }

        return array_values($lowStock);
    }

    /** Manual stock change (restock/waste/manual/transfer). */
    public function adjust(Ingredient $ingredient, float $qtyDelta, string $reason, ?int $userId = null): StockMovement
    {
        return $this->apply($ingredient, $qtyDelta, $reason, userId: $userId);
    }

    /** @return \Illuminate\Support\Collection<int,Ingredient> */
    public function lowStock()
    {
        return Ingredient::query()
            ->whereNotNull('stock_qty')
            ->whereNotNull('low_stock_threshold')
            ->whereColumn('stock_qty', '<=', 'low_stock_threshold')
            ->orderBy('name')
            ->get();
    }

    protected function consumedCanonical(float $recipeQty, string $recipeUnit, int $yield, int $orderQty): float
    {
        $canonicalForYield = UnitConverter::toCanonical($recipeQty, $recipeUnit);

        return round(($canonicalForYield / $yield) * $orderQty, 3);
    }

    protected function apply(Ingredient $ingredient, float $qtyDelta, string $reason, ?int $orderItemId = null, ?int $userId = null): StockMovement
    {
        $ingredient->update(['stock_qty' => (float) $ingredient->stock_qty + $qtyDelta]);

        return StockMovement::create([
            'ingredient_id' => $ingredient->id,
            'order_item_id' => $orderItemId,
            'qty_delta' => $qtyDelta,
            'reason' => $reason,
            'created_by' => $userId,
            'created_at' => now(),
        ]);
    }

    protected function isLow(Ingredient $ingredient): bool
    {
        return $ingredient->stock_qty !== null
            && $ingredient->low_stock_threshold !== null
            && $ingredient->stock_qty <= $ingredient->low_stock_threshold;
    }
}
