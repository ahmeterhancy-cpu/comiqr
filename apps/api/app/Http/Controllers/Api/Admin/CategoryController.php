<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Menu category management (M1, docs/06 §6.5). Tenant-scoped by the global scope.
 */
class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categories = Category::query()
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->with('translations')
            ->orderBy('sort')
            ->get();

        return response()->json(['data' => CategoryResource::collection($categories)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $category = Category::create($data);

        return response()->json(['data' => new CategoryResource($category)], 201);
    }

    public function update(Request $request, string $category): JsonResponse
    {
        // Explicit lookup (not route-model binding) so the tenant scope — set by
        // the tenant.user middleware — is guaranteed active here (docs/04 §4.2).
        $model = Category::findOrFail($category);
        $model->update($this->validateData($request, $model->id));

        return response()->json(['data' => new CategoryResource($model->fresh())]);
    }

    public function destroy(string $category): JsonResponse
    {
        Category::findOrFail($category)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name' => [$id ? 'sometimes' : 'required', 'string', 'max:255'],
            'branch_id' => ['nullable', Rule::exists('branches', 'id')],
            'parent_id' => ['nullable', Rule::exists('categories', 'id')],
            'sort' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['boolean'],
            'image_path' => ['nullable', 'string'],
            'daypart_json' => ['nullable', 'array'],
        ]);
    }
}
