<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\IngredientResource;
use App\Jobs\RecomputeNutrition;
use App\Models\Ingredient;
use App\Models\Product;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Ingredient master-card management (M2, docs/06 §6.6). Editing an ingredient
 * re-derives nutrition for every product whose recipe uses it (docs/03 §3.3).
 */
class IngredientController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    public function index(Request $request): JsonResponse
    {
        $ingredients = Ingredient::query()
            ->when($request->filled('q'), fn ($q) => $q->where('name', 'ilike', '%'.$request->string('q').'%'))
            ->with('allergens')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => IngredientResource::collection($ingredients)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $ingredient = Ingredient::create($data);
        $this->syncAllergens($ingredient, $request);

        return response()->json(['data' => new IngredientResource($ingredient->load('allergens'))], 201);
    }

    public function update(Request $request, string $ingredient): JsonResponse
    {
        $model = Ingredient::findOrFail($ingredient);
        $model->update($this->validateData($request, $model->id));
        $this->syncAllergens($model, $request);

        $this->recomputeAffectedProducts($model->id);

        return response()->json(['data' => new IngredientResource($model->fresh('allergens'))]);
    }

    public function destroy(string $ingredient): JsonResponse
    {
        Ingredient::findOrFail($ingredient)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        $required = $id ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'unit' => [$required, Rule::in(['g', 'ml', 'adet'])],
            'grams_per_unit' => ['nullable', 'numeric', 'min:0', 'required_if:unit,adet'],
            'kcal' => ['nullable', 'numeric', 'min:0'],
            'protein_g' => ['nullable', 'numeric', 'min:0'],
            'carb_g' => ['nullable', 'numeric', 'min:0'],
            'fat_g' => ['nullable', 'numeric', 'min:0'],
            'saturated_fat_g' => ['nullable', 'numeric', 'min:0'],
            'sugar_g' => ['nullable', 'numeric', 'min:0'],
            'fiber_g' => ['nullable', 'numeric', 'min:0'],
            'sodium_mg' => ['nullable', 'numeric', 'min:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'cost_unit' => ['nullable', 'string', 'max:16'],
            'waste_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_vegan' => ['boolean'],
            'is_vegetarian' => ['boolean'],
            'is_gluten_free' => ['boolean'],
            'stock_qty' => ['nullable', 'numeric'],
            'low_stock_threshold' => ['nullable', 'numeric'],
            'data_source' => ['nullable', Rule::in(['manual', 'usda', 'tuber', 'ai_estimated'])],
            'allergens' => ['nullable', 'array'],
            'allergens.*.id' => ['required_with:allergens', Rule::exists('allergens', 'id')],
            'allergens.*.trace' => ['boolean'],
        ]);
    }

    private function syncAllergens(Ingredient $ingredient, Request $request): void
    {
        if (! $request->has('allergens')) {
            return;
        }

        $sync = [];
        foreach ($request->input('allergens', []) as $row) {
            $sync[(int) $row['id']] = ['trace' => (bool) ($row['trace'] ?? false)];
        }
        $ingredient->allergens()->sync($sync);
    }

    private function recomputeAffectedProducts(int $ingredientId): void
    {
        Product::query()
            ->whereHas('recipe.items', fn ($q) => $q->where('ingredient_id', $ingredientId))
            ->pluck('id')
            ->each(fn ($productId) => RecomputeNutrition::dispatch($this->tenants->id(), $productId));
    }
}
