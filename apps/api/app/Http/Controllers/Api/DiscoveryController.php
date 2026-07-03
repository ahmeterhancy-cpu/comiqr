<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public consumer discovery portal (M20, docs/01 §1.5). Central, tenant-less:
 * lists active venues that have a live menu so guests can browse and open a
 * venue's public menu (/v/{slug}). Costs/PII are never exposed.
 */
class DiscoveryController extends Controller
{
    public function __construct(protected \App\Services\ReviewService $reviews) {}

    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $tenants = Tenant::query()
            ->whereIn('status', ['active', 'trialing'])
            ->when($q !== '', fn ($qq) => $qq->where('name', 'ilike', "%{$q}%"))
            ->orderBy('name')
            ->limit(50)
            ->get(['id', 'name', 'slug', 'currency']);

        // Cross-tenant read → bypass the tenant scope explicitly, then group.
        $products = Product::withoutTenancy()
            ->where('is_active', true)
            ->whereIn('tenant_id', $tenants->pluck('id'))
            ->orderBy('sort')
            ->get(['id', 'tenant_id', 'name', 'image_paths_json']);

        $byTenant = $products->groupBy('tenant_id');
        $rep = $this->reviews->reputationFor($tenants->pluck('id')->all());

        $data = $tenants->map(function (Tenant $tenant) use ($byTenant, $rep) {
            $items = $byTenant->get($tenant->id, collect());

            return [
                'slug' => $tenant->slug,
                'name' => $tenant->name,
                'currency' => $tenant->currency,
                'product_count' => $items->count(),
                'rating' => $rep[$tenant->id]['average'] ?? 0,
                'reviews_count' => $rep[$tenant->id]['count'] ?? 0,
                'samples' => $items->take(3)->map(fn (Product $p) => [
                    'name' => $p->name,
                    'image' => $p->image_paths_json[0] ?? null,
                ])->values(),
            ];
        })
            ->filter(fn (array $v) => $v['product_count'] > 0)
            ->values();

        return response()->json(['data' => $data]);
    }
}
