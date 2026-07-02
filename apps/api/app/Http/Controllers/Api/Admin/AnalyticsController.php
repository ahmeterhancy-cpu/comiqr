<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\MenuView;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Basic analytics (M9, docs/06 §6.11). Tenant-scoped. Revenue is realised
 * revenue (paid payments). Heavier reports (heatmap/profitability) come in V2.
 */
class AnalyticsController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    public function overview(Request $request): JsonResponse
    {
        $to = $request->date('to') ?? now();
        $from = $request->date('from') ?? now()->copy()->subDays(30);
        $branchId = $request->integer('branch_id') ?: null;

        $branchFilter = fn ($q) => $branchId ? $q->where('branch_id', $branchId) : $q;

        $orderCount = $branchFilter(Order::whereBetween('placed_at', [$from, $to]))->count();

        $revenue = (float) Payment::where('status', 'paid')
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId, fn ($q) => $q->whereHas('order', fn ($o) => $o->where('branch_id', $branchId)))
            ->sum('amount');

        $paidOrders = $branchFilter(
            Order::where('payment_status', 'paid')->whereBetween('placed_at', [$from, $to]),
        )->count();

        $scans = $branchFilter(MenuView::whereBetween('viewed_at', [$from, $to]))->count();

        $topProducts = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            // Raw join bypasses the global scope — constrain to the tenant explicitly.
            ->where('orders.tenant_id', $this->tenants->id())
            ->when($branchId, fn ($q) => $q->where('orders.branch_id', $branchId))
            ->whereBetween('orders.placed_at', [$from, $to])
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->selectRaw('products.id, products.name, SUM(order_items.quantity) as qty, SUM(order_items.line_total) as revenue')
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('qty')
            ->limit(5)
            ->get();

        return response()->json(['data' => [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'scans' => $scans,
            'orders' => $orderCount,
            'revenue' => round($revenue, 2),
            'avg_order_value' => $paidOrders > 0 ? round($revenue / $paidOrders, 2) : 0,
            'scan_to_order_rate' => $scans > 0 ? round($orderCount / $scans, 4) : null,
            'top_products' => $topProducts,
        ]]);
    }

    /**
     * Menu-engineering heatmap (M9, docs/06 §6.11). Plots every active product on
     * two axes — popularity (units sold) × profitability (unit contribution =
     * price − recipe cost) — and classifies it into the classic quadrants:
     *   star (popular + profitable) · plowhorse (popular, low margin) ·
     *   puzzle (unpopular, high margin) · dog (unpopular, low margin).
     * Thresholds are the medians across the menu, so it adapts to each venue.
     */
    public function heatmap(Request $request): JsonResponse
    {
        $to = $request->date('to') ?? now();
        $from = $request->date('from') ?? now()->copy()->subDays(30);
        $branchId = $request->integer('branch_id') ?: null;

        // Impressions per product (M9 menu views).
        $views = MenuView::whereBetween('viewed_at', [$from, $to])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereNotNull('product_id')
            ->selectRaw('product_id, count(*) as c')
            ->groupBy('product_id')
            ->pluck('c', 'product_id');

        // Units + revenue per product. Raw join bypasses the global scope, so the
        // tenant is constrained explicitly (mirrors overview()).
        $sales = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.tenant_id', $this->tenants->id())
            ->when($branchId, fn ($q) => $q->where('orders.branch_id', $branchId))
            ->whereBetween('orders.placed_at', [$from, $to])
            ->selectRaw('order_items.product_id, SUM(order_items.quantity) as qty, SUM(order_items.line_total) as revenue')
            ->groupBy('order_items.product_id')
            ->get()
            ->keyBy('product_id');

        $products = Product::where('is_active', true)
            ->with(['category:id,name', 'nutritionSummary'])
            ->get();

        $rows = $products->map(function (Product $p) use ($views, $sales) {
            $qty = (int) ($sales[$p->id]->qty ?? 0);
            $revenue = (float) ($sales[$p->id]->revenue ?? 0);
            $seen = (int) ($views[$p->id] ?? 0);
            $cost = (float) ($p->nutritionSummary->cost_per_portion ?? 0);
            $unitMargin = round((float) $p->price - $cost, 2);

            return [
                'id' => $p->id,
                'name' => $p->name,
                'category' => $p->category?->name,
                'views' => $seen,
                'qty' => $qty,
                'revenue' => round($revenue, 2),
                'conversion' => $seen > 0 ? round($qty / $seen, 4) : null,
                'unit_margin' => $unitMargin,
            ];
        })->values();

        // Popularity must clear at least one sale; profitability uses the median.
        $popThreshold = max(1.0, $this->median($rows->pluck('qty')->all()));
        $marginThreshold = $this->median($rows->pluck('unit_margin')->all());

        $rows = $rows->map(function (array $r) use ($popThreshold, $marginThreshold) {
            $popular = $r['qty'] >= $popThreshold;
            $profitable = $r['unit_margin'] >= $marginThreshold;
            $r['quadrant'] = $popular
                ? ($profitable ? 'star' : 'plowhorse')
                : ($profitable ? 'puzzle' : 'dog');

            return $r;
        })
            ->sortByDesc(fn ($r) => [$r['qty'], $r['revenue']])
            ->values();

        $counts = $rows->countBy('quadrant');

        return response()->json(['data' => [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'thresholds' => ['popularity' => $popThreshold, 'margin' => $marginThreshold],
            'quadrant_counts' => [
                'star' => (int) ($counts['star'] ?? 0),
                'plowhorse' => (int) ($counts['plowhorse'] ?? 0),
                'puzzle' => (int) ($counts['puzzle'] ?? 0),
                'dog' => (int) ($counts['dog'] ?? 0),
            ],
            'products' => $rows,
        ]]);
    }

    /** Median of a numeric list (nulls ignored). Returns 0 for an empty list. */
    private function median(array $values): float
    {
        $values = array_values(array_filter($values, fn ($v) => $v !== null));
        sort($values);
        $n = count($values);
        if ($n === 0) {
            return 0.0;
        }
        $mid = intdiv($n, 2);

        return $n % 2 === 1
            ? (float) $values[$mid]
            : ((float) $values[$mid - 1] + (float) $values[$mid]) / 2;
    }
}
