<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * AI menu tasks (M7, docs/06 §6.10). Manager+, plan-gated (plan:ai). Returns 503
 * when no AI provider is configured rather than fabricating content.
 */
class AiController extends Controller
{
    public function __construct(protected AiService $ai) {}

    /** POST /admin/ai/product-copy — generate an appetising description. */
    public function productCopy(Request $request): JsonResponse
    {
        $this->ensureConfigured();

        $data = $request->validate([
            'product_id' => ['required', Rule::exists('products', 'id')],
            'tone' => ['nullable', 'string', 'max:32'],
            'save' => ['boolean'],
        ]);

        $product = Product::findOrFail($data['product_id']);
        $copy = $this->ai->productCopy($product, $data['tone'] ?? 'appetizing');

        if ($request->boolean('save')) {
            $product->update(['description' => $copy]);
        }

        return response()->json(['data' => ['product_id' => $product->id, 'description' => $copy]]);
    }

    /** POST /admin/ai/translate-menu — translate products into a locale. */
    public function translateMenu(Request $request): JsonResponse
    {
        $this->ensureConfigured();

        $data = $request->validate([
            'locale' => ['required', Rule::in(['en', 'de', 'ru', 'ar'])],
            'product_ids' => ['nullable', 'array'],
            'product_ids.*' => ['integer'],
        ]);

        $products = Product::query()
            ->when($data['product_ids'] ?? null, fn ($q, $ids) => $q->whereIn('id', $ids))
            ->where('is_active', true)
            ->limit(100)
            ->get();

        $count = 0;
        foreach ($products as $product) {
            $t = $this->ai->translateProduct($product, $data['locale']);
            ProductTranslation::updateOrCreate(
                ['product_id' => $product->id, 'locale' => $data['locale']],
                ['name' => $t['name'], 'description' => $t['description']],
            );
            $count++;
        }

        return response()->json(['data' => ['locale' => $data['locale'], 'translated' => $count]]);
    }

    private function ensureConfigured(): void
    {
        abort_unless($this->ai->isConfigured(), 503, 'AI is not configured for this deployment.');
    }
}
