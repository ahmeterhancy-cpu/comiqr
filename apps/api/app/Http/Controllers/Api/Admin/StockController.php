<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\IngredientResource;
use App\Models\Ingredient;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Inventory / stock (Faz 2, M2/M18, docs/06 §6.12). Tenant-scoped, manager+.
 */
class StockController extends Controller
{
    public function __construct(protected StockService $stock) {}

    /** POST /admin/stock-movements — manual restock/waste/adjust. */
    public function move(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ingredient_id' => ['required', Rule::exists('ingredients', 'id')],
            'qty_delta' => ['required', 'numeric', 'not_in:0'],
            'reason' => ['required', Rule::in(['manual', 'waste', 'restock', 'transfer'])],
        ]);

        $ingredient = Ingredient::findOrFail($data['ingredient_id']);
        if ($ingredient->stock_qty === null) {
            $ingredient->update(['stock_qty' => 0]);
        }

        $movement = $this->stock->adjust($ingredient->fresh(), (float) $data['qty_delta'], $data['reason'], $request->user()->id);

        return response()->json(['data' => [
            'ingredient_id' => $ingredient->id,
            'qty_delta' => $movement->qty_delta,
            'reason' => $movement->reason,
            'stock_qty' => $ingredient->fresh()->stock_qty,
        ]], 201);
    }

    /** GET /admin/inventory/low-stock — ingredients at/below threshold. */
    public function lowStock(): JsonResponse
    {
        return response()->json(['data' => IngredientResource::collection($this->stock->lowStock())]);
    }
}
