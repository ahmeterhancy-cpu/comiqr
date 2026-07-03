<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Models\Review;
use App\Services\AiService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * AI menu tasks (M7, docs/06 §6.10). Manager+, plan-gated (plan:ai). Returns 503
 * when no AI provider is configured rather than fabricating content.
 */
class AiController extends Controller
{
    public function __construct(
        protected AiService $ai,
        protected TenantManager $tenants,
    ) {}

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

    /** POST /admin/ai/menu-insights — menu-engineering advice from sales + margin. */
    public function menuInsights(Request $request): JsonResponse
    {
        $this->ensureConfigured();

        $branchId = $request->integer('branch_id') ?: null;

        $sales = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.tenant_id', $this->tenants->id())
            ->when($branchId, fn ($q) => $q->where('orders.branch_id', $branchId))
            ->where('orders.placed_at', '>=', now()->subDays(30))
            ->selectRaw('order_items.product_id, SUM(order_items.quantity) as qty, SUM(order_items.line_total) as revenue')
            ->groupBy('order_items.product_id')
            ->orderByDesc('qty')
            ->limit(25)
            ->get();

        abort_if($sales->isEmpty(), 422, 'Son 30 günde yeterli satış verisi yok.');

        $products = Product::whereIn('id', $sales->pluck('product_id'))->with('nutritionSummary')->get()->keyBy('id');

        $items = $sales->map(fn ($s) => [
            'name' => $products[$s->product_id]?->name ?? "#{$s->product_id}",
            'qty' => (int) $s->qty,
            'revenue' => round((float) $s->revenue, 2),
            'margin' => round((float) ($products[$s->product_id]?->price ?? 0)
                - (float) ($products[$s->product_id]?->nutritionSummary->cost_per_portion ?? 0), 2),
        ])->all();

        $insights = $this->ai->menuInsights($items, $this->tenants->get()?->currency ?? 'TRY');

        return response()->json(['data' => ['insights' => $insights, 'products' => count($items)]]);
    }

    /** POST /admin/ai/review-summary — sentiment + themes + action items. */
    public function reviewSummary(): JsonResponse
    {
        $this->ensureConfigured();

        $reviews = Review::query()
            ->where('status', 'published')
            ->latest()
            ->limit(100)
            ->get(['rating', 'comment']);

        abort_if($reviews->isEmpty(), 422, 'Henüz özetlenecek değerlendirme yok.');

        $summary = $this->ai->reviewSummary(
            $reviews->map(fn ($r) => ['rating' => (int) $r->rating, 'comment' => $r->comment])->all(),
        );

        return response()->json(['data' => ['summary' => $summary, 'reviews' => $reviews->count()]]);
    }

    private function ensureConfigured(): void
    {
        abort_unless($this->ai->isConfigured(), 503, 'AI is not configured for this deployment.');
    }
}
