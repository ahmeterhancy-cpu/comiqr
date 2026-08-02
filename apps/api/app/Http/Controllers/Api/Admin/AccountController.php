<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Services\AccountLedger;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * Current accounts / cari hesaplar (Faz 4). Tenant-scoped, manager+.
 *
 * Balances are never written here — every movement goes through
 * {@see AccountLedger}, which locks the account and records the signed delta.
 */
class AccountController extends Controller
{
    public function __construct(protected AccountLedger $ledger) {}

    public function index(Request $request): JsonResponse
    {
        $accounts = Account::query()
            ->when($request->string('type')->toString(), fn ($q, $t) => $q->where('type', $t))
            ->when($request->boolean('only_debtors'), fn ($q) => $q->where('balance', '>', 0))
            ->when($request->string('q')->toString(), fn ($q, $term) => $q->where('name', 'ilike', "%{$term}%"))
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $accounts,
            'meta' => [
                'receivable_total' => round((float) $accounts->where('balance', '>', 0)->sum('balance'), 2),
                'payable_total' => round((float) abs($accounts->where('balance', '<', 0)->sum('balance')), 2),
            ],
        ]);
    }

    public function show(string $account): JsonResponse
    {
        $model = Account::findOrFail($account);

        return response()->json(['data' => $model]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        // The opening balance IS the starting balance; it is not a ledger movement,
        // so the cached balance starts from it and the ledger sums on top.
        $data['balance'] = (float) ($data['opening_balance'] ?? 0);

        return response()->json(['data' => Account::create($data)], 201);
    }

    public function update(Request $request, string $account): JsonResponse
    {
        $model = Account::findOrFail($account);
        $data = $this->validateData($request, $model->id);
        $openingChanged = array_key_exists('opening_balance', $data)
            && (float) $data['opening_balance'] !== (float) $model->opening_balance;

        $model->update($data);

        if ($openingChanged) {
            // Re-derive rather than nudge: balance = opening + Σ ledger.
            $this->ledger->recalculate($model->fresh());
        }

        return response()->json(['data' => $model->fresh()]);
    }

    public function destroy(string $account): JsonResponse
    {
        $model = Account::findOrFail($account);
        abort_if(
            abs((float) $model->balance) >= 0.01,
            422,
            'Bakiyesi kapanmamış cari silinemez. Önce tahsilat/ödeme girin.',
        );

        $model->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** GET /admin/accounts/{account}/transactions — ledger, newest first. */
    public function transactions(Request $request, string $account): JsonResponse
    {
        $model = Account::findOrFail($account);

        $rows = $model->transactions()
            ->with('order:id,grand_total', 'expense:id,description')
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->paginate(min(200, max(10, $request->integer('per_page') ?: 50)));

        return response()->json([
            'data' => $rows,
            'meta' => ['balance' => round((float) $model->balance, 2)],
        ]);
    }

    /**
     * POST /admin/accounts/{account}/transactions — tahsilat / ödeme / düzeltme.
     * `direction` is what the operator means; the ledger turns it into a signed delta:
     *   collect (tahsilat, borcunu ödedi) · settle (biz ödedik) · adjustment (serbest).
     */
    public function storeTransaction(Request $request, string $account): JsonResponse
    {
        $model = Account::findOrFail($account);

        $data = $request->validate([
            'direction' => ['required', Rule::in(['collect', 'settle', 'charge', 'adjustment'])],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999'],
            'method' => ['nullable', Rule::in(['cash', 'card', 'transfer'])],
            'occurred_on' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:500'],
            // Only read for `adjustment`, where the operator picks the direction.
            'sign' => ['nullable', Rule::in(['debit', 'credit'])],
        ]);

        $amount = (float) $data['amount'];
        $meta = [
            'method' => $data['method'] ?? null,
            'occurred_on' => $data['occurred_on'] ?? now()->toDateString(),
            'note' => $data['note'] ?? null,
            'created_by' => Auth::id(),
        ];

        $transaction = match ($data['direction']) {
            'collect' => $this->ledger->collect($model, $amount, $meta),
            'settle' => $this->ledger->settle($model, $amount, $meta),
            'charge' => $this->ledger->charge($model, $amount, $meta),
            'adjustment' => $this->ledger->post(
                $model,
                'adjustment',
                ($data['sign'] ?? 'debit') === 'debit' ? $amount : -$amount,
                $meta,
            ),
        };

        return response()->json([
            'data' => $transaction,
            'meta' => ['balance' => round((float) $model->fresh()->balance, 2)],
        ], 201);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        $tenantId = app(TenantManager::class)->id();
        $required = $id ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:120'],
            'type' => [$required, Rule::in(Account::TYPES)],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:120'],
            'tax_no' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:2000'],
            'credit_limit' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'opening_balance' => ['nullable', 'numeric', 'min:-99999999', 'max:99999999'],
            'customer_id' => [
                'nullable',
                Rule::exists('customers', 'id')->where('tenant_id', $tenantId)->whereNull('deleted_at'),
            ],
            'is_active' => ['boolean'],
        ]);
    }
}
