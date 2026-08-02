<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Support\Restaurant\Vat;
use App\Support\Tenancy\TenantManager;
use Illuminate\Support\Carbon;

/**
 * Rapor Kokpiti (Faz 4 — roadmap madde 4): the deeper cuts a venue manager asks
 * for once the P&L headline is in place — when we are busy, what sells, who sold
 * it, what we gave away, and how the tax splits.
 *
 * Two conventions run through every section:
 *
 *  - **Effective line revenue.** A line's `line_total` already nets its own
 *    discount, but an order-level discount sits on the order. It is allocated
 *    back to the lines pro rata (line_total ÷ subtotal), so every breakdown here
 *    sums to the same net sales the P&L reports — and so VAT is not charged on
 *    money the guest never paid.
 *  - **Venue-local clock.** Timestamps are stored in the app timezone; the hourly
 *    cut converts them to the tenant's own zone, so a venue in another country
 *    still sees its own evening rush at 20:00.
 */
class CockpitReport
{
    public function __construct(protected TenantManager $tenants) {}

    /**
     * @return array<string,mixed>
     */
    public function build(Carbon $from, Carbon $to, ?int $branchId = null): array
    {
        return [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'hourly' => $this->hourly($from, $to, $branchId),
            'categories' => $this->categories($from, $to, $branchId),
            'staff' => $this->staff($from, $to, $branchId),
            'giveaways' => $this->giveaways($from, $to, $branchId),
            'tax' => $this->tax($from, $to, $branchId),
        ];
    }

    /**
     * Weekday × hour heat matrix in the venue's own timezone, plus the busiest
     * single slot — the number a manager actually staffs against.
     */
    protected function hourly(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $local = $this->localTimestamp('orders.placed_at');

        $rows = $this->soldItems($from, $to, $branchId)
            ->selectRaw(
                "EXTRACT(ISODOW FROM {$local}) as dow,
                 EXTRACT(HOUR FROM {$local}) as hour,
                 COALESCE(SUM({$this->effectiveGross()}), 0) as revenue,
                 COUNT(DISTINCT orders.id) as orders",
            )
            ->groupByRaw("EXTRACT(ISODOW FROM {$local}), EXTRACT(HOUR FROM {$local})")
            ->get();

        $matrix = [];
        $peak = null;

        foreach ($rows as $row) {
            // ISODOW: 1 = Monday .. 7 = Sunday → 0-based index for the UI.
            $dow = (int) $row->dow - 1;
            $hour = (int) $row->hour;
            $revenue = round((float) $row->revenue, 2);

            $matrix[$dow][$hour] = ['revenue' => $revenue, 'orders' => (int) $row->orders];

            if ($peak === null || $revenue > $peak['revenue']) {
                $peak = ['weekday' => $dow, 'hour' => $hour, 'revenue' => $revenue, 'orders' => (int) $row->orders];
            }
        }

        return [
            'matrix' => $matrix,
            'peak' => $peak,
            'max_revenue' => $peak['revenue'] ?? 0,
        ];
    }

    /** What each menu category actually contributes — volume, revenue and margin. */
    protected function categories(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $rows = $this->soldItems($from, $to, $branchId)
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->leftJoin('nutrition_summaries', 'nutrition_summaries.product_id', '=', 'order_items.product_id')
            ->selectRaw(
                "categories.id, categories.name,
                 SUM(order_items.quantity) as qty,
                 COALESCE(SUM({$this->effectiveGross()}), 0) as revenue,
                 COALESCE(SUM(order_items.quantity * COALESCE(NULLIF(order_items.unit_cost, 0), NULLIF(nutrition_summaries.cost_per_portion, 0), 0)), 0) as cost",
            )
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc('revenue')
            ->get();

        $total = (float) $rows->sum('revenue');

        return $rows->map(fn ($r) => [
            'id' => $r->id,
            'name' => $r->name ?? 'Kategorisiz',
            'qty' => (int) $r->qty,
            'revenue' => round((float) $r->revenue, 2),
            'cost' => round((float) $r->cost, 2),
            'profit' => round((float) $r->revenue - (float) $r->cost, 2),
            'share_pct' => $total > 0 ? round((float) $r->revenue / $total * 100, 2) : 0,
        ])->all();
    }

    /**
     * Per-operator sales. Orders a guest placed from the QR menu carry no
     * operator; they are reported as their own row rather than dropped, so the
     * rows still add up to the period's sales.
     */
    protected function staff(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $rows = $this->orders($from, $to, $branchId)
            ->leftJoin('users', 'users.id', '=', 'orders.created_by')
            ->selectRaw(
                'users.id, users.name, users.role,
                 COUNT(*) as orders,
                 COALESCE(SUM(orders.subtotal - orders.discount_total), 0) as revenue',
            )
            ->groupBy('users.id', 'users.name', 'users.role')
            ->orderByDesc('revenue')
            ->get();

        return $rows->map(fn ($r) => [
            'id' => $r->id,
            'name' => $r->name,          // null → self-service (QR/kiosk)
            'role' => $r->role,
            'orders' => (int) $r->orders,
            'revenue' => round((float) $r->revenue, 2),
            'avg_order' => (int) $r->orders > 0 ? round((float) $r->revenue / (int) $r->orders, 2) : 0,
        ])->all();
    }

    /**
     * Money that left the till without a sale behind it: voided lines, line and
     * order discounts. The leak a POS is bought to make visible.
     */
    protected function giveaways(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $voids = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.tenant_id', $this->tenants->id())
            ->whereBetween('orders.placed_at', [$from, $to])
            ->where('order_items.status', 'cancelled')
            ->when($branchId, fn ($q) => $q->where('orders.branch_id', $branchId))
            ->selectRaw('COUNT(*) as lines, COALESCE(SUM(order_items.unit_price * order_items.quantity), 0) as amount')
            ->first();

        $lineDiscounts = $this->soldItems($from, $to, $branchId)
            ->selectRaw('COALESCE(SUM(order_items.discount_total), 0) as amount')
            ->value('amount');

        $orderDiscounts = $this->orders($from, $to, $branchId)
            ->selectRaw('COALESCE(SUM(orders.discount_total), 0) as amount, COUNT(*) FILTER (WHERE orders.discount_total > 0) as c')
            ->first();

        $bySource = $this->orders($from, $to, $branchId)
            ->where('orders.discount_total', '>', 0)
            ->selectRaw('COALESCE(orders.discount_source, \'manuel\') as source, COALESCE(SUM(orders.discount_total), 0) as amount')
            ->groupBy('orders.discount_source')
            ->orderByDesc('amount')
            ->get()
            ->map(fn ($r) => ['source' => $r->source, 'amount' => round((float) $r->amount, 2)])
            ->all();

        return [
            'void_lines' => (int) $voids->lines,
            'void_amount' => round((float) $voids->amount, 2),
            'line_discounts' => round((float) $lineDiscounts, 2),
            'order_discounts' => round((float) $orderDiscounts->amount, 2),
            'discounted_orders' => (int) $orderDiscounts->c,
            'by_source' => $bySource,
            'total' => round((float) $voids->amount + (float) $lineDiscounts + (float) $orderDiscounts->amount, 2),
        ];
    }

    /**
     * VAT breakdown by rate. Menu prices are VAT-inclusive, so each rate's tax is
     * extracted from what was actually charged. The rate is the one frozen on the
     * line at sale time; older lines fall back to the product's current rate, then
     * to the tenant default.
     */
    protected function tax(Carbon $from, Carbon $to, ?int $branchId): array
    {
        $default = Vat::tenantRate($this->tenants->get()?->settings_json);
        // The default is inlined as a literal, not bound: the same expression has to
        // appear in SELECT and GROUP BY, and Postgres treats two different parameter
        // placeholders as two different expressions. It is a float we just rounded,
        // so nothing user-authored reaches the SQL.
        $rate = sprintf('COALESCE(order_items.vat_rate, products.vat_rate, %.2f)', $default);

        $rows = $this->soldItems($from, $to, $branchId)
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->selectRaw("{$rate} as rate, COALESCE(SUM({$this->effectiveGross()}), 0) as gross")
            ->groupByRaw($rate)
            ->orderByRaw($rate)
            ->get();

        $lines = $rows->map(function ($r) {
            $rate = round((float) $r->rate, 2);
            $gross = round((float) $r->gross, 2);
            $vat = Vat::extract($gross, $rate);

            return [
                'rate' => $rate,
                'gross' => $gross,
                'net' => round($gross - $vat, 2),
                'vat' => $vat,
            ];
        });

        return [
            'default_rate' => $default,
            'lines' => $lines->all(),
            'gross_total' => round((float) $lines->sum('gross'), 2),
            'net_total' => round((float) $lines->sum('net'), 2),
            'vat_total' => round((float) $lines->sum('vat'), 2),
        ];
    }

    /**
     * A line's revenue after its share of the order-level discount. `subtotal` is
     * the sum of the order's line totals, so the ratio distributes the discount
     * exactly; a zero subtotal (fully voided order) collapses to zero.
     */
    protected function effectiveGross(): string
    {
        return 'order_items.line_total * (1 - COALESCE(orders.discount_total, 0) / NULLIF(orders.subtotal, 0))';
    }

    /**
     * `placed_at` re-read in the tenant's own timezone (a no-op when it matches
     * the app's). The zone names are inlined rather than bound because the same
     * expression is repeated in SELECT and GROUP BY, where positional bindings
     * would have to be counted by hand; both names are validated against PHP's
     * timezone database first, so nothing user-authored reaches the SQL.
     */
    protected function localTimestamp(string $column): string
    {
        $app = $this->safeTimezone(config('app.timezone', 'UTC'));
        $venue = $this->safeTimezone($this->tenants->get()?->timezone ?: $app);

        return "({$column} AT TIME ZONE '{$app}' AT TIME ZONE '{$venue}')";
    }

    /** A known IANA zone name, or UTC. */
    protected function safeTimezone(?string $tz): string
    {
        try {
            return (new \DateTimeZone((string) $tz))->getName();
        } catch (\Exception) {
            return 'UTC';
        }
    }

    /** Non-cancelled orders in range. Raw joins → explicit tenant filter. */
    protected function orders(Carbon $from, Carbon $to, ?int $branchId)
    {
        return Order::query()
            ->whereBetween('orders.placed_at', [$from, $to])
            ->where('orders.status', '!=', 'cancelled')
            ->when($branchId, fn ($q) => $q->where('orders.branch_id', $branchId));
    }

    /** Sold (non-voided) lines in range, joined to their order. */
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
