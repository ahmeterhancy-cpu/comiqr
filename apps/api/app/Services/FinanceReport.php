<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Support\Tenancy\TenantManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Profit & loss / maliyet-kâr raporu (Faz 4).
 *
 * The report is ACCRUAL, not cash: it measures the business a period did, so a
 * veresiye sale counts as revenue the day it was served even though the money
 * arrives later. The cash side is reported alongside it (collected by tender +
 * credit sales) so the two are never confused.
 *
 *   net_sales   = subtotal − discounts + delivery fees   (tax and tips excluded —
 *                 tax is passed through to the state, tips to the staff)
 *   cogs        = Σ qty × unit_cost   (cost frozen on the line at sale time;
 *                 falls back to the product's current recipe cost when the line
 *                 predates the snapshot, and is 0 for products with no recipe)
 *   gross_profit = net_sales − cogs
 *   net_profit   = gross_profit − expenses (net of VAT)
 *
 * Raw joins bypass the tenant global scope, so every one of them constrains
 * orders.tenant_id explicitly (same rule as AnalyticsController).
 */
class FinanceReport
{
    public function __construct(protected TenantManager $tenants) {}

    /**
     * @return array<string,mixed>
     */
    public function profitLoss(Carbon $from, Carbon $to, ?int $branchId = null): array
    {
        $sales = $this->sales($from, $to, $branchId);
        $cogs = $this->cogs($from, $to, $branchId);
        $expenses = $this->expenses($from, $to, $branchId);

        $netSales = $sales['net_sales'];
        $grossProfit = round($netSales - $cogs['cogs'], 2);
        $netProfit = round($grossProfit - $expenses['total'], 2);

        return [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'sales' => $sales,
            'cogs' => $cogs,
            'expenses' => $expenses,
            'gross_profit' => $grossProfit,
            'gross_margin_pct' => $netSales > 0 ? round($grossProfit / $netSales * 100, 2) : null,
            'net_profit' => $netProfit,
            'net_margin_pct' => $netSales > 0 ? round($netProfit / $netSales * 100, 2) : null,
            'cash' => $this->cash($from, $to, $branchId),
            'daily' => $this->daily($from, $to, $branchId),
            'top_products' => $this->topProducts($from, $to, $branchId),
        ];
    }

    /** Sales side, from the orders themselves (accrual). Cancelled orders excluded. */
    protected function sales(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $row = $this->orders($from, $to, $branchId)
            ->selectRaw(
                'COUNT(*) as orders,
                 COALESCE(SUM(subtotal), 0) as gross,
                 COALESCE(SUM(discount_total), 0) as discounts,
                 COALESCE(SUM(delivery_fee), 0) as delivery,
                 COALESCE(SUM(tax_total), 0) as tax,
                 COALESCE(SUM(tip_total), 0) as tips',
            )
            ->first();

        $netSales = round((float) $row->gross - (float) $row->discounts + (float) $row->delivery, 2);

        return [
            'orders' => (int) $row->orders,
            'gross_sales' => round((float) $row->gross, 2),
            'discounts' => round((float) $row->discounts, 2),
            'delivery_fees' => round((float) $row->delivery, 2),
            'net_sales' => $netSales,
            'tax' => round((float) $row->tax, 2),
            'tips' => round((float) $row->tips, 2),
            'avg_order_value' => (int) $row->orders > 0 ? round($netSales / (int) $row->orders, 2) : 0,
        ];
    }

    /**
     * Cost of goods sold, plus how much of the sold revenue actually carried a
     * known cost — a menu with half its recipes missing would otherwise report a
     * flatteringly high margin with no warning.
     */
    protected function cogs(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $row = $this->soldItems($from, $to, $branchId)
            ->leftJoin('nutrition_summaries', 'nutrition_summaries.product_id', '=', 'order_items.product_id')
            ->selectRaw(
                'COALESCE(SUM(order_items.quantity * COALESCE(NULLIF(order_items.unit_cost, 0), NULLIF(nutrition_summaries.cost_per_portion, 0), 0)), 0) as cogs,
                 COALESCE(SUM(CASE WHEN COALESCE(NULLIF(order_items.unit_cost, 0), NULLIF(nutrition_summaries.cost_per_portion, 0)) IS NULL
                                   THEN order_items.line_total ELSE 0 END), 0) as uncosted,
                 COALESCE(SUM(order_items.line_total), 0) as line_total',
            )
            ->first();

        $lineTotal = (float) $row->line_total;
        $uncosted = (float) $row->uncosted;

        return [
            'cogs' => round((float) $row->cogs, 2),
            // Reçetesi olmayan ürünlerin cirosu — maliyeti 0 sayıldı.
            'uncosted_sales' => round($uncosted, 2),
            'coverage_pct' => $lineTotal > 0 ? round(($lineTotal - $uncosted) / $lineTotal * 100, 2) : null,
        ];
    }

    /** Expense side: net-of-VAT total plus a per-category breakdown. */
    protected function expenses(Carbon $from, Carbon $to, ?int $branchId): array
    {
        // A branch-filtered report still carries expenses with no branch on them:
        // rent, accounting, licences are business-wide overhead, and dropping them
        // would make a single-branch venue's report show profit it never made.
        $base = fn () => Expense::whereBetween('spent_on', [$from->toDateString(), $to->toDateString()])
            ->when($branchId, fn ($q) => $q->where(
                fn ($w) => $w->where('branch_id', $branchId)->orWhereNull('branch_id'),
            ));

        $totals = $base()
            ->selectRaw('COALESCE(SUM(amount), 0) as net, COALESCE(SUM(tax_amount), 0) as tax, COUNT(*) as c')
            ->first();

        $byCategory = $base()
            ->leftJoin('expense_categories', 'expense_categories.id', '=', 'expenses.expense_category_id')
            ->selectRaw(
                'expense_categories.id, expense_categories.name, expense_categories.color, expense_categories.is_fixed,
                 COALESCE(SUM(expenses.amount), 0) as total',
            )
            ->groupBy('expense_categories.id', 'expense_categories.name', 'expense_categories.color', 'expense_categories.is_fixed')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name ?? 'Kategorisiz',
                'color' => $r->color,
                'is_fixed' => (bool) $r->is_fixed,
                'total' => round((float) $r->total, 2),
            ]);

        return [
            'total' => round((float) $totals->net, 2),
            'tax' => round((float) $totals->tax, 2),
            'count' => (int) $totals->c,
            'by_category' => $byCategory,
        ];
    }

    /** The cash view next to the accrual one: what was actually collected, and on what. */
    protected function cash(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $rows = Payment::where('status', 'paid')
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId, fn ($q) => $q->whereHas('order', fn ($o) => $o->where('branch_id', $branchId)))
            ->selectRaw('gateway, COALESCE(SUM(amount), 0) as amount, COALESCE(SUM(tip_amount), 0) as tips')
            ->groupBy('gateway')
            ->get();

        $byTender = $rows->mapWithKeys(fn ($r) => [
            $r->gateway => round((float) $r->amount + (float) $r->tips, 2),
        ]);

        return [
            'by_tender' => $byTender,
            'collected' => round((float) $byTender->sum(), 2),
            // Veresiye — sold and booked as revenue, but the money is still out there.
            'credit_sales' => round((float) ($byTender['credit'] ?? 0), 2),
        ];
    }

    /** Day-by-day series for the chart: net sales, COGS, expenses, profit. */
    protected function daily(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $sales = $this->orders($from, $to, $branchId)
            ->selectRaw('DATE(placed_at) as d, COALESCE(SUM(subtotal - discount_total + delivery_fee), 0) as net')
            ->groupBy(DB::raw('DATE(placed_at)'))
            ->pluck('net', 'd');

        $cogs = $this->soldItems($from, $to, $branchId)
            ->leftJoin('nutrition_summaries', 'nutrition_summaries.product_id', '=', 'order_items.product_id')
            ->selectRaw('DATE(orders.placed_at) as d, COALESCE(SUM(order_items.quantity * COALESCE(NULLIF(order_items.unit_cost, 0), NULLIF(nutrition_summaries.cost_per_portion, 0), 0)), 0) as c')
            ->groupBy(DB::raw('DATE(orders.placed_at)'))
            ->pluck('c', 'd');

        $expenses = Expense::whereBetween('spent_on', [$from->toDateString(), $to->toDateString()])
            ->when($branchId, fn ($q) => $q->where(
                fn ($w) => $w->where('branch_id', $branchId)->orWhereNull('branch_id'),
            ))
            ->selectRaw('spent_on as d, COALESCE(SUM(amount), 0) as e')
            ->groupBy('spent_on')
            ->pluck('e', 'd');

        $key = fn ($value) => $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : substr((string) $value, 0, 10);
        $salesByDay = collect($sales)->mapWithKeys(fn ($v, $k) => [$key($k) => (float) $v]);
        $cogsByDay = collect($cogs)->mapWithKeys(fn ($v, $k) => [$key($k) => (float) $v]);
        $expByDay = collect($expenses)->mapWithKeys(fn ($v, $k) => [$key($k) => (float) $v]);

        $days = [];
        for ($day = $from->copy()->startOfDay(); $day->lte($to); $day->addDay()) {
            $d = $day->toDateString();
            $net = round($salesByDay[$d] ?? 0, 2);
            $c = round($cogsByDay[$d] ?? 0, 2);
            $e = round($expByDay[$d] ?? 0, 2);

            $days[] = [
                'date' => $d,
                'net_sales' => $net,
                'cogs' => $c,
                'expenses' => $e,
                'profit' => round($net - $c - $e, 2),
            ];
        }

        return $days;
    }

    /** Most profitable products by total contribution (revenue − cost), not by volume. */
    protected function topProducts(Carbon $from, Carbon $to, ?int $branchId, int $limit = 10): array
    {
        return $this->soldItems($from, $to, $branchId)
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->leftJoin('nutrition_summaries', 'nutrition_summaries.product_id', '=', 'order_items.product_id')
            ->selectRaw(
                'products.id, products.name,
                 SUM(order_items.quantity) as qty,
                 COALESCE(SUM(order_items.line_total), 0) as revenue,
                 COALESCE(SUM(order_items.quantity * COALESCE(NULLIF(order_items.unit_cost, 0), NULLIF(nutrition_summaries.cost_per_portion, 0), 0)), 0) as cost',
            )
            ->groupBy('products.id', 'products.name')
            ->orderByRaw('COALESCE(SUM(order_items.line_total), 0) - COALESCE(SUM(order_items.quantity * COALESCE(NULLIF(order_items.unit_cost, 0), NULLIF(nutrition_summaries.cost_per_portion, 0), 0)), 0) DESC')
            ->limit($limit)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'qty' => (int) $r->qty,
                'revenue' => round((float) $r->revenue, 2),
                'cost' => round((float) $r->cost, 2),
                'profit' => round((float) $r->revenue - (float) $r->cost, 2),
                'margin_pct' => (float) $r->revenue > 0
                    ? round(((float) $r->revenue - (float) $r->cost) / (float) $r->revenue * 100, 2)
                    : null,
            ])
            ->all();
    }

    /** Receivables / payables snapshot across the current accounts. */
    public function accountsSummary(): array
    {
        $accounts = Account::where('is_active', true)->get(['id', 'name', 'type', 'balance', 'credit_limit']);

        $receivable = $accounts->where('balance', '>', 0);
        $payable = $accounts->where('balance', '<', 0);

        return [
            'receivable_total' => round((float) $receivable->sum('balance'), 2),
            'payable_total' => round((float) abs($payable->sum('balance')), 2),
            'receivable' => $receivable->sortByDesc('balance')->values()->map(fn ($a) => [
                'id' => $a->id, 'name' => $a->name, 'type' => $a->type,
                'balance' => round((float) $a->balance, 2),
                'credit_limit' => round((float) $a->credit_limit, 2),
            ])->all(),
            'payable' => $payable->sortBy('balance')->values()->map(fn ($a) => [
                'id' => $a->id, 'name' => $a->name, 'type' => $a->type,
                'balance' => round((float) $a->balance, 2),
            ])->all(),
        ];
    }

    /** Non-cancelled orders placed in the range (tenant scope applies via the model). */
    protected function orders(Carbon $from, Carbon $to, ?int $branchId)
    {
        return Order::whereBetween('placed_at', [$from, $to])
            ->where('status', '!=', 'cancelled')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId));
    }

    /** Sold (non-voided) order lines in the range. Raw join → explicit tenant filter. */
    protected function soldItems(Carbon $from, Carbon $to, ?int $branchId)
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.tenant_id', $this->tenants->id())
            ->where('orders.status', '!=', 'cancelled')
            ->where('order_items.status', '!=', 'cancelled')
            ->whereBetween('orders.placed_at', [$from, $to])
            ->when($branchId, fn ($q) => $q->where('orders.branch_id', $branchId));
    }
}
