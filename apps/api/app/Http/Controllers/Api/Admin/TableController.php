<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\TableResource;
use App\Models\Branch;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Table / QR management (M3, docs/06 §6 admin). Tenant-scoped. Supports bulk QR
 * generation (a whole floor at once) and per-table token rotation.
 */
class TableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tables = Table::query()
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->with(['sessions', 'diningArea:id,name,type'])
            ->orderBy('code')
            ->get();

        return response()->json(['data' => TableResource::collection($tables)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $data['branch_id'] ??= $this->defaultBranchId();
        $table = Table::create($data);

        return response()->json(['data' => new TableResource($table)], 201);
    }

    public function update(Request $request, string $table): JsonResponse
    {
        $model = Table::findOrFail($table);
        $model->update($this->validateData($request, $model->id));

        return response()->json(['data' => new TableResource($model->fresh())]);
    }

    public function destroy(string $table): JsonResponse
    {
        Table::findOrFail($table)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** POST /admin/tables/{id}/regenerate-token — rotate the QR token. */
    public function regenerate(string $table): JsonResponse
    {
        $model = Table::findOrFail($table);
        $model->regenerateToken();

        return response()->json(['data' => new TableResource($model->fresh())]);
    }

    /** POST /admin/tables/bulk — create N tables in one go. */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'count' => ['required', 'integer', 'min:1', 'max:500'],
            'prefix' => ['nullable', 'string', 'max:32'],
            'start_from' => ['nullable', 'integer', 'min:1'],
            'branch_id' => ['nullable', Rule::exists('branches', 'id')],
            'dining_area_id' => ['nullable', Rule::exists('dining_areas', 'id')],
        ]);

        $prefix = $data['prefix'] ?? 'Masa';
        $start = $data['start_from'] ?? 1;
        $branchId = $data['branch_id'] ?? $this->defaultBranchId();

        $created = DB::transaction(function () use ($data, $prefix, $start, $branchId) {
            $tables = [];
            for ($i = 0; $i < $data['count']; $i++) {
                $tables[] = Table::create([
                    'branch_id' => $branchId,
                    'dining_area_id' => $data['dining_area_id'] ?? null,
                    'code' => trim($prefix.' '.($start + $i)),
                ]);
            }

            return $tables;
        });

        return response()->json(['data' => TableResource::collection(collect($created))], 201);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'code' => [$id ? 'sometimes' : 'required', 'string', 'max:64'],
            'branch_id' => ['nullable', Rule::exists('branches', 'id')],
            'dining_area_id' => ['nullable', Rule::exists('dining_areas', 'id')],
            'is_active' => ['boolean'],
        ]);
    }

    private function defaultBranchId(): int
    {
        return Branch::query()->orderBy('id')->value('id')
            ?? abort(422, 'No branch available for this tenant.');
    }
}
