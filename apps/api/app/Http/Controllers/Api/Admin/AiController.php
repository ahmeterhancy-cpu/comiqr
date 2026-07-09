<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Models\Review;
use App\Services\AiService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

    /**
     * POST /admin/ai/import-menu — build the whole menu from photos/PDF (Nameless-style).
     * Reads up to 5 images or a PDF with vision, then creates categories, products and
     * variants for the active tenant. Manager+, plan:ai, provider must support images.
     */
    public function importMenu(Request $request): JsonResponse
    {
        $this->ensureConfigured();
        abort_unless($this->ai->supportsVision(), 503, 'AI sağlayıcısı görsel okumayı desteklemiyor.');

        $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:5'],
            'files.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        $media = [];
        foreach ($request->file('files') as $file) {
            $mime = $file->getMimeType() ?? 'image/jpeg';
            $media[] = [
                'type' => $mime === 'application/pdf' ? 'document' : 'image',
                'media_type' => $mime,
                'data' => base64_encode((string) file_get_contents($file->getRealPath())),
            ];
        }

        $locale = $this->tenants->get()?->locale_default ?? config('app.locale');

        try {
            $parsed = $this->ai->importMenuFromImages($media, $locale);
        } catch (\Throwable $e) {
            abort(422, 'Menü okunamadı: '.$e->getMessage());
        }

        $result = $this->createMenuFromParsed($parsed['categories']);
        abort_if($result['products'] === 0, 422, 'Görselden ürün çıkarılamadı. Daha net bir fotoğraf deneyin.');

        return response()->json(['data' => $result], 201);
    }

    /**
     * Persist the AI-extracted menu. Runs inside the active tenant context (tenant.user
     * middleware) so BelongsToTenant scopes every row. Variant prices are absolute in the
     * AI output; stored as a delta from the product's base (smallest) price.
     *
     * @param  array<int,array<string,mixed>>  $categories
     * @return array{categories:int,products:int}
     */
    private function createMenuFromParsed(array $categories): array
    {
        $catCount = 0;
        $prodCount = 0;
        $sort = (int) Category::query()->max('sort');

        DB::transaction(function () use ($categories, &$catCount, &$prodCount, &$sort) {
            foreach ($categories as $cat) {
                $catName = trim((string) ($cat['name'] ?? ''));
                if ($catName === '' || ! is_array($cat['products'] ?? null)) {
                    continue;
                }

                $category = Category::create(['name' => $catName, 'sort' => ++$sort, 'is_active' => true]);
                $catCount++;

                $psort = 0;
                foreach ($cat['products'] as $prod) {
                    $name = trim((string) ($prod['name'] ?? ''));
                    if ($name === '') {
                        continue;
                    }

                    $variants = array_values(array_filter(
                        is_array($prod['variants'] ?? null) ? $prod['variants'] : [],
                        fn ($v) => is_array($v) && trim((string) ($v['name'] ?? '')) !== '',
                    ));

                    $base = (float) ($prod['price'] ?? 0);
                    if ($variants) {
                        $base = min(array_map(fn ($v) => (float) ($v['price'] ?? 0), $variants));
                    }

                    $product = Product::create([
                        'category_id' => $category->id,
                        'name' => $name,
                        'description' => trim((string) ($prod['description'] ?? '')) ?: null,
                        'price' => round(max($base, 0), 2),
                        'is_active' => true,
                        'sort' => ++$psort,
                    ]);
                    $prodCount++;

                    foreach ($variants as $i => $v) {
                        $product->variants()->create([
                            'name' => trim((string) $v['name']),
                            'price_delta' => round((float) ($v['price'] ?? 0) - $base, 2),
                            'is_default' => $i === 0,
                            'sort' => $i,
                        ]);
                    }
                }
            }
        });

        return ['categories' => $catCount, 'products' => $prodCount];
    }

    private function ensureConfigured(): void
    {
        abort_unless($this->ai->isConfigured(), 503, 'AI is not configured for this deployment.');
    }
}
