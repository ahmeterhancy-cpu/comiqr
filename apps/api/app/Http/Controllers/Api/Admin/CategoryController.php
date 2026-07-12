<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Menu category management (M1, docs/06 §6.5). Tenant-scoped by the global scope.
 */
class CategoryController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}
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

    /** POST /admin/categories/reorder — persist a new drag-and-drop order. */
    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ]);

        // Tenant scope guarantees we only touch this tenant's categories.
        foreach (array_values($data['ids']) as $index => $id) {
            Category::where('id', $id)->update(['sort' => $index]);
        }

        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * POST /admin/categories/media — upload a category cover image; returns its URL.
     * Not tied to a category id, so it works while creating a brand-new category
     * (the URL is then saved via create/update image_path). Mirrors RestaurantMedia.
     */
    public function uploadMedia(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        abort_unless($this->tenants->check(), 403, 'No active tenant.');
        $tenant = $this->tenants->get();

        $path = 'categories/'.$tenant->id.'/'.Str::uuid().'.'.$request->file('image')->extension();
        Storage::disk('public')->put($path, $request->file('image')->getContent());

        return response()->json(['data' => ['url' => url('/v1/media/'.$path)]], 201);
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
            // Category promotion (percent discount on all its products).
            'promo_json' => ['nullable', 'array'],
            'promo_json.enabled' => ['sometimes', 'boolean'],
            'promo_json.percent' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:95'],
            'promo_json.label' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);
    }
}
