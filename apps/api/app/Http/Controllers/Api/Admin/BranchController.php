<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Branch management (M12 multi-branch, docs/06 §6). Tenant-scoped; used to scope
 * KDS/tables/analytics per location.
 */
class BranchController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Branch::orderBy('id')->get(['id', 'name', 'address', 'phone', 'is_active', 'lat', 'lng']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => Branch::create($this->validateData($request))], 201);
    }

    public function update(Request $request, string $branch): JsonResponse
    {
        $model = Branch::findOrFail($branch);
        $model->update($this->validateData($request, true));

        return response()->json(['data' => $model->fresh()]);
    }

    public function destroy(string $branch): JsonResponse
    {
        // Keep at least one branch — a tenant always needs somewhere to operate.
        abort_if(Branch::count() <= 1, 422, 'A tenant must keep at least one branch.');
        Branch::findOrFail($branch)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function validateData(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['boolean'],
        ]);
    }
}
