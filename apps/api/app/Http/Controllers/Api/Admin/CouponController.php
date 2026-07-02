<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Coupon management (Faz 2, M8, docs/06 §6.9). Tenant-scoped, manager+.
 */
class CouponController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Coupon::orderByDesc('id')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => Coupon::create($this->validateData($request))], 201);
    }

    public function update(Request $request, string $coupon): JsonResponse
    {
        $model = Coupon::findOrFail($coupon);
        $model->update($this->validateData($request, $model->id));

        return response()->json(['data' => $model->fresh()]);
    }

    public function destroy(string $coupon): JsonResponse
    {
        Coupon::findOrFail($coupon)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        $tenantId = app(\App\Support\Tenancy\TenantManager::class)->id();

        return $request->validate([
            'code' => [
                $id ? 'sometimes' : 'required', 'string', 'max:64',
                Rule::unique('coupons', 'code')->where('tenant_id', $tenantId)->ignore($id),
            ],
            'type' => [$id ? 'sometimes' : 'required', Rule::in(['percent', 'amount', 'free_item'])],
            'value' => [$id ? 'sometimes' : 'required', 'numeric', 'min:0'],
            'conditions_json' => ['nullable', 'array'],
            'valid_from' => ['nullable', 'date'],
            'valid_to' => ['nullable', 'date', 'after_or_equal:valid_from'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['boolean'],
        ]);
    }
}
