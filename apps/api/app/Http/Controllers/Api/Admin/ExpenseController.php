<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\Expense;
use App\Services\AccountLedger;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Expenses (Faz 4 — gider yönetimi). Tenant-scoped, manager+.
 *
 * An expense paid on credit terms (`payment_method = credit`) with a supplier
 * account attached also posts a payable to that account's ledger. The ledger row
 * mirrors the expense, so editing or deleting the expense rewrites it — that is
 * the one place in this module where a ledger row is not append-only.
 */
class ExpenseController extends Controller
{
    public function __construct(protected AccountLedger $ledger) {}

    public function index(Request $request): JsonResponse
    {
        $to = $request->date('to') ?? now();
        $from = $request->date('from') ?? now()->copy()->startOfMonth();

        $query = Expense::with(['category:id,name,color', 'account:id,name', 'branch:id,name'])
            ->whereBetween('spent_on', [$from->toDateString(), $to->toDateString()])
            ->when($request->integer('branch_id'), fn ($q, $id) => $q->where('branch_id', $id))
            ->when($request->integer('expense_category_id'), fn ($q, $id) => $q->where('expense_category_id', $id))
            ->when($request->integer('account_id'), fn ($q, $id) => $q->where('account_id', $id))
            ->when($request->string('payment_method')->toString(), fn ($q, $m) => $q->where('payment_method', $m))
            ->orderByDesc('spent_on')
            ->orderByDesc('id');

        $totals = (clone $query)->reorder()
            ->selectRaw('COALESCE(SUM(amount), 0) as net, COALESCE(SUM(tax_amount), 0) as tax, COUNT(*) as c')
            ->first();

        return response()->json([
            'data' => $query->paginate(min(100, max(10, $request->integer('per_page') ?: 50))),
            'meta' => [
                'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'total' => round((float) $totals->net, 2),
                'tax_total' => round((float) $totals->tax, 2),
                'count' => (int) $totals->c,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);

        $expense = DB::transaction(function () use ($data) {
            $expense = Expense::create($data + ['created_by' => Auth::id()]);
            $this->syncPayable($expense);

            return $expense;
        });

        return response()->json(['data' => $expense->fresh(['category', 'account'])], 201);
    }

    public function update(Request $request, string $expense): JsonResponse
    {
        $model = Expense::findOrFail($expense);
        $data = $this->validateData($request, $model->id);

        DB::transaction(function () use ($model, $data) {
            $model->update($data);
            $this->syncPayable($model->fresh());
        });

        return response()->json(['data' => $model->fresh(['category', 'account'])]);
    }

    public function destroy(string $expense): JsonResponse
    {
        $model = Expense::findOrFail($expense);

        DB::transaction(function () use ($model) {
            $this->clearPayable($model);
            $model->delete();
        });

        return response()->json(['data' => ['deleted' => true]]);
    }

    /**
     * Keep the supplier ledger in step with the expense: drop any row this
     * expense previously posted, then post a fresh payable if it is still on
     * credit terms with an account attached.
     */
    private function syncPayable(Expense $expense): void
    {
        $this->clearPayable($expense);

        if ($expense->payment_method !== 'credit' || ! $expense->account_id) {
            return;
        }

        $account = Account::findOrFail($expense->account_id);
        $this->ledger->purchaseForExpense($account, $expense);
    }

    /** Remove the ledger row mirroring this expense and re-derive the balance. */
    private function clearPayable(Expense $expense): void
    {
        $existing = AccountTransaction::where('expense_id', $expense->id)->get();

        foreach ($existing->groupBy('account_id') as $accountId => $rows) {
            $rows->each->delete();
            $account = Account::find($accountId);
            if ($account) {
                $this->ledger->recalculate($account);
            }
        }
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        $tenantId = app(TenantManager::class)->id();
        // Tenant-constrained AND alive — a soft-deleted row must not be re-attachable.
        $scoped = fn (string $table) => Rule::exists($table, 'id')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at');
        $required = $id ? 'sometimes' : 'required';

        return $request->validate([
            'description' => [$required, 'string', 'max:200'],
            'amount' => [$required, 'numeric', 'min:0', 'max:99999999'],
            'tax_amount' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'payment_method' => [$required, Rule::in(Expense::METHODS)],
            'spent_on' => [$required, 'date'],
            'expense_category_id' => ['nullable', $scoped('expense_categories')],
            'account_id' => ['nullable', $scoped('accounts')],
            'branch_id' => ['nullable', $scoped('branches')],
            'document_no' => ['nullable', 'string', 'max:64'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
