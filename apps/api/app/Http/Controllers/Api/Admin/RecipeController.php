<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\NutritionSummaryResource;
use App\Jobs\RecomputeNutrition;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecipeItem;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Recipe + nutrition endpoints (M2, docs/06 §6.6). Saving a recipe recomputes
 * the nutrition summary on the queue; the response reports is_stale=true and the
 * panel is updated when the job finishes (docs/03 §3.3).
 */
class RecipeController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    /** GET /admin/products/{id}/recipe */
    public function show(string $product): JsonResponse
    {
        $model = Product::with('recipe.items.ingredient')->findOrFail($product);
        $recipe = $model->recipe;

        return response()->json(['data' => [
            'product_id' => $model->id,
            'yield_portions' => $recipe?->yield_portions ?? 1,
            'prep_minutes' => $recipe?->prep_minutes,
            'notes' => $recipe?->notes,
            'items' => $recipe ? $recipe->items->map(fn (RecipeItem $i) => [
                'ingredient_id' => $i->ingredient_id,
                'ingredient_name' => $i->ingredient?->name,
                'quantity' => $i->quantity,
                'unit' => $i->unit,
            ]) : [],
        ]]);
    }

    /** PUT /admin/products/{id}/recipe */
    public function update(string $product): JsonResponse
    {
        $model = Product::findOrFail($product);

        $data = request()->validate([
            'yield_portions' => ['required', 'integer', 'min:1'],
            'prep_minutes' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['present', 'array'],
            'items.*.ingredient_id' => ['required', Rule::exists('ingredients', 'id')],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['required', Rule::in(['g', 'ml', 'adet', 'kg', 'l', 'cl', 'mg'])],
        ]);

        DB::transaction(function () use ($model, $data) {
            $recipe = Recipe::updateOrCreate(
                ['product_id' => $model->id],
                [
                    'yield_portions' => $data['yield_portions'],
                    'prep_minutes' => $data['prep_minutes'] ?? null,
                    'notes' => $data['notes'] ?? null,
                ],
            );

            $recipe->items()->delete();
            foreach ($data['items'] as $item) {
                $recipe->items()->create([
                    'ingredient_id' => $item['ingredient_id'],
                    'quantity' => $item['quantity'],
                    'unit' => $item['unit'],
                ]);
            }

            $model->nutritionSummary()->update(['is_stale' => true]);
        });

        RecomputeNutrition::dispatch($this->tenants->id(), $model->id);

        return response()->json(['data' => ['product_id' => $model->id, 'is_stale' => true]]);
    }

    /** GET /admin/products/{id}/nutrition (owner view — includes cost). */
    public function nutrition(string $product): JsonResponse
    {
        $model = Product::with('nutritionSummary')->findOrFail($product);
        $summary = $model->nutritionSummary;

        return response()->json([
            'data' => $summary ? (new NutritionSummaryResource($summary))->withCost() : null,
        ]);
    }

    /** POST /admin/products/{id}/nutrition/recompute */
    public function recompute(string $product): JsonResponse
    {
        $model = Product::findOrFail($product);
        RecomputeNutrition::dispatch($this->tenants->id(), $model->id);

        return response()->json(['data' => ['product_id' => $model->id, 'queued' => true]]);
    }
}
