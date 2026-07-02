<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Product variants (M1, docs/05 §5.2) — size/portion options with a price delta.
 * Scoped through the product's tenant (findOrFail after tenant.user middleware).
 */
class ProductVariantController extends Controller
{
    public function store(Request $request, string $product): JsonResponse
    {
        $model = Product::findOrFail($product);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:64'],
            'price_delta' => ['required', 'numeric'],
            'is_default' => ['boolean'],
        ]);

        if ($request->boolean('is_default')) {
            $model->variants()->update(['is_default' => false]);
        }

        $variant = $model->variants()->create($data);

        return response()->json(['data' => $variant], 201);
    }

    public function destroy(string $product, string $variant): JsonResponse
    {
        $model = Product::findOrFail($product);
        $model->variants()->whereKey($variant)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }
}
