<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\MenuView;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
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
}
