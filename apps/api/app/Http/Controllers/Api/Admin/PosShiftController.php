<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Shift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POS cash-drawer shift (Faz 3 — ultra POS). A cashier opens a drawer with a
 * starting float; while open it accrues cash/card sales; closing it counts the
 * drawer and produces a Z-report (expected vs counted → over/short). One open
 * shift per branch at a time. Reuses the tenant-scoped Payment ledger.
 */
class PosShiftController extends Controller
{
    /** POST /admin/pos/shift/open — start a drawer with a cash float. */
    public function open(Request $request): JsonResponse
    {
        $data = $request->validate([
            'opening_float' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $branchId = $data['branch_id'] ?? null;

        $existing = Shift::query()->where('status', 'open')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->first();
        abort_if($existing !== null, 422, 'Zaten açık bir vardiya var. Önce onu kapatın.');

        $shift = Shift::create([
            'branch_id' => $branchId,
            'opened_by' => $request->user()?->id,
            'status' => 'open',
            'opening_float' => (float) ($data['opening_float'] ?? 0),
            'opened_at' => now(),
        ]);

        return response()->json(['data' => $this->report($shift)], 201);
    }

    /** GET /admin/pos/shift/current — the open drawer + live tallies, or null. */
    public function current(Request $request): JsonResponse
    {
        $branchId = $request->query('branch_id');

        $shift = Shift::query()->where('status', 'open')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->latest('opened_at')
            ->first();

        return response()->json(['data' => $shift ? $this->report($shift) : null]);
    }

    /** POST /admin/pos/shift/{shift}/close — count the drawer, freeze the Z-report. */
    public function close(Request $request, string $shift): JsonResponse
    {
        $data = $request->validate([
            'counted_cash' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $model = Shift::findOrFail($shift);
        abort_if($model->status !== 'open', 422, 'Vardiya zaten kapatılmış.');

        $tally = $this->tally($model);
        $counted = round((float) $data['counted_cash'], 2);
        $expected = round((float) $model->opening_float + $tally['cash_sales'], 2);

        $model->update([
            'status' => 'closed',
            'closed_by' => $request->user()?->id,
            'closed_at' => now(),
            'counted_cash' => $counted,
            'expected_cash' => $expected,
            'cash_sales' => $tally['cash_sales'],
            'card_sales' => $tally['card_sales'],
            'other_sales' => $tally['other_sales'],
            'orders_count' => $tally['orders_count'],
            'over_short' => round($counted - $expected, 2),
            'note' => $data['note'] ?? null,
        ]);

        return response()->json(['data' => $this->report($model->fresh())]);
    }

    /**
     * Sum paid payments inside the shift window (tenant-scoped by Payment's global
     * scope). A closed shift uses its frozen figures; an open one is live.
     *
     * @return array{cash_sales:float,card_sales:float,other_sales:float,orders_count:int}
     */
    protected function tally(Shift $shift): array
    {
        if ($shift->status === 'closed') {
            return [
                'cash_sales' => (float) $shift->cash_sales,
                'card_sales' => (float) $shift->card_sales,
                'other_sales' => (float) $shift->other_sales,
                'orders_count' => (int) $shift->orders_count,
            ];
        }

        $base = Payment::query()
            ->where('status', 'paid')
            ->where('created_at', '>=', $shift->opened_at)
            ->when($shift->branch_id, fn ($q) => $q->whereHas('order', fn ($o) => $o->where('branch_id', $shift->branch_id)));

        // Tips are real money in the drawer, so count principal + tip per tender.
        $sum = fn ($q) => round((float) $q->selectRaw('COALESCE(SUM(amount + tip_amount), 0) as s')->value('s'), 2);

        return [
            'cash_sales' => $sum((clone $base)->where('gateway', 'cash')),
            'card_sales' => $sum((clone $base)->where('gateway', 'card')),
            'other_sales' => $sum((clone $base)->whereNotIn('gateway', ['cash', 'card'])),
            'orders_count' => (int) (clone $base)->distinct('order_id')->count('order_id'),
        ];
    }

    /** @return array<string,mixed> */
    protected function report(Shift $shift): array
    {
        $tally = $this->tally($shift);
        $expected = $shift->status === 'closed'
            ? (float) $shift->expected_cash
            : round((float) $shift->opening_float + $tally['cash_sales'], 2);

        return [
            'id' => $shift->id,
            'status' => $shift->status,
            'opening_float' => (float) $shift->opening_float,
            'cash_sales' => $tally['cash_sales'],
            'card_sales' => $tally['card_sales'],
            'other_sales' => $tally['other_sales'],
            'total_sales' => round($tally['cash_sales'] + $tally['card_sales'] + $tally['other_sales'], 2),
            'orders_count' => $tally['orders_count'],
            'expected_cash' => $expected,
            'counted_cash' => $shift->counted_cash !== null ? (float) $shift->counted_cash : null,
            'over_short' => $shift->over_short !== null ? (float) $shift->over_short : null,
            'opened_by' => $shift->openedBy?->name,
            'opened_at' => $shift->opened_at,
            'closed_at' => $shift->closed_at,
        ];
    }
}
