<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ModifierGroupResource;
use App\Models\ModifierGroup;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Modifier groups (M1, docs/05 §5.2) — reusable add-on/option sets (e.g. "Ekstra
 * Malzeme", "Pişme Derecesi") with min/max/required selection bounds. Groups are
 * tenant-owned and attached to products via the product_modifier_group pivot.
 * All lookups go through the tenant global scope (findOrFail after tenant.user).
 */
class ModifierGroupController extends Controller
{
    /** GET /admin/modifier-groups — every group with its options and attached product ids. */
    public function index(): JsonResponse
    {
        $groups = ModifierGroup::with(['modifiers', 'products:id'])->orderBy('name')->get();

        $data = $groups->map(fn (ModifierGroup $group) => array_merge(
            (new ModifierGroupResource($group->loadMissing('modifiers')))->resolve(),
            ['product_ids' => $group->products->pluck('id')->all()],
        ));

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateGroup($request);
        $group = ModifierGroup::create($data);

        return response()->json(['data' => new ModifierGroupResource($group->load('modifiers'))], 201);
    }

    public function update(Request $request, string $group): JsonResponse
    {
        $model = ModifierGroup::findOrFail($group);
        $model->update($this->validateGroup($request));

        return response()->json(['data' => new ModifierGroupResource($model->load('modifiers'))]);
    }

    public function destroy(string $group): JsonResponse
    {
        $model = ModifierGroup::findOrFail($group);
        $model->products()->detach();
        $model->modifiers()->delete();
        $model->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** POST /admin/modifier-groups/{group}/modifiers — add an option to a group. */
    public function storeModifier(Request $request, string $group): JsonResponse
    {
        $model = ModifierGroup::findOrFail($group);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:64'],
            'price_delta' => ['required', 'numeric'],
            'sort' => ['integer'],
        ]);

        $modifier = $model->modifiers()->create($data);

        return response()->json(['data' => $modifier], 201);
    }

    public function destroyModifier(string $group, string $modifier): JsonResponse
    {
        $model = ModifierGroup::findOrFail($group);
        $model->modifiers()->whereKey($modifier)->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** POST /admin/products/{product}/modifier-groups — attach an existing group to a product. */
    public function attach(Request $request, string $product): JsonResponse
    {
        $model = Product::findOrFail($product);
        $data = $request->validate([
            'modifier_group_id' => ['required', 'integer'],
        ]);

        // findOrFail applies the tenant scope, so a group from another tenant 404s.
        $group = ModifierGroup::findOrFail($data['modifier_group_id']);
        $model->modifierGroups()->syncWithoutDetaching([$group->id]);

        return response()->json(['data' => ['attached' => true]]);
    }

    public function detach(string $product, string $group): JsonResponse
    {
        $model = Product::findOrFail($product);
        $model->modifierGroups()->detach($group);

        return response()->json(['data' => ['detached' => true]]);
    }

    /** @return array<string,mixed> */
    private function validateGroup(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:64'],
            'min_select' => ['integer', 'min:0', 'max:20'],
            'max_select' => ['integer', 'min:1', 'max:20'],
            'is_required' => ['boolean'],
        ]);
    }
}
