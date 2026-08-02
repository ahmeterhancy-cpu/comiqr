<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Expense categories (Faz 4 — gider yönetimi). Tenant-scoped, manager+.
 */
class ExpenseCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ExpenseCategory::withCount('expenses')->orderBy('sort')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => ExpenseCategory::create($this->validateData($request))], 201);
    }

    public function update(Request $request, string $category): JsonResponse
    {
        $model = ExpenseCategory::findOrFail($category);
        $model->update($this->validateData($request, $model->id));

        return response()->json(['data' => $model->fresh()]);
    }

    public function destroy(string $category): JsonResponse
    {
        // Soft delete — expenses keep pointing at the row so old reports stay readable.
        ExpenseCategory::findOrFail($category)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        $tenantId = app(TenantManager::class)->id();

        return $request->validate([
            'name' => [
                $id ? 'sometimes' : 'required', 'string', 'max:80',
                Rule::unique('expense_categories', 'name')
                    ->where('tenant_id', $tenantId)
                    ->whereNull('deleted_at')
                    ->ignore($id),
            ],
            'color' => ['nullable', 'string', 'max:9'],
            'is_fixed' => ['boolean'],
            'sort' => ['integer', 'min:0', 'max:9999'],
            'is_active' => ['boolean'],
        ]);
    }
}
