<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\DiningArea;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Dining area management (M3). Tenant-scoped groupings of tables.
 */
class DiningAreaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => DiningArea::orderBy('name')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $data['branch_id'] ??= Branch::query()->orderBy('id')->value('id') ?? abort(422, 'No branch available.');

        return response()->json(['data' => DiningArea::create($data)], 201);
    }

    public function update(Request $request, string $diningArea): JsonResponse
    {
        $model = DiningArea::findOrFail($diningArea);
        $model->update($this->validateData($request, true));

        return response()->json(['data' => $model->fresh()]);
    }

    public function destroy(string $diningArea): JsonResponse
    {
        DiningArea::findOrFail($diningArea)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function validateData(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'type' => ['nullable', Rule::in(['table', 'room', 'sunbed', 'stand'])],
            'branch_id' => ['nullable', Rule::exists('branches', 'id')],
        ]);
    }
}
