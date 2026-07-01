<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Jobs\RecomputeNutrition;
use App\Models\Product;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Product management (M1, docs/06 §6.5). Price changes re-derive nutrition margin.
 */
class ProductController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    public function index(Request $request): JsonResponse
    {
        $products = Product::query()
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->with(['variants', 'nutritionSummary'])
            ->orderBy('sort')
            ->get();

        return response()->json(['data' => ProductResource::collection($products)]);
    }

    public function show(string $product): JsonResponse
    {
        $model = Product::with(['variants', 'nutritionSummary', 'modifierGroups.modifiers'])->findOrFail($product);

        return response()->json(['data' => new ProductResource($model)]);
    }

    public function store(Request $request): JsonResponse
    {
        $product = Product::create($this->validateData($request));

        return response()->json(['data' => new ProductResource($product->load('variants'))], 201);
    }

    public function update(Request $request, string $product): JsonResponse
    {
        $model = Product::findOrFail($product);
        $priceChanged = $request->has('price') && (float) $request->input('price') !== (float) $model->price;

        $model->update($this->validateData($request, $model->id));

        // Price feeds margin in the nutrition summary — refresh it (docs/03 §3.6).
        if ($priceChanged && $model->recipe()->exists()) {
            RecomputeNutrition::dispatch($this->tenants->id(), $model->id);
        }

        return response()->json(['data' => new ProductResource($model->fresh('variants'))]);
    }

    public function destroy(string $product): JsonResponse
    {
        Product::findOrFail($product)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'category_id' => [$id ? 'sometimes' : 'required', Rule::exists('categories', 'id')],
            'name' => [$id ? 'sometimes' : 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => [$id ? 'sometimes' : 'required', 'numeric', 'min:0'],
            'image_paths_json' => ['nullable', 'array'],
            'video_path' => ['nullable', 'string'],
            'is_active' => ['boolean'],
            'sort' => ['nullable', 'integer', 'min:0'],
            'prep_minutes' => ['nullable', 'integer', 'min:0'],
            'calories_display' => ['boolean'],
            'tags_json' => ['nullable', 'array'],
        ]);
    }
}
