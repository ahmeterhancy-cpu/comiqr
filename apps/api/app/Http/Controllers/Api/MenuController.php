<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesQrToken;
use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Allergen;
use App\Models\Branch;
use App\Models\Category;
use App\Models\EightySixItem;
use App\Models\MenuView;
use App\Models\Table;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public menu (M1/M4, docs/06 §6.2). Two entry points:
 *  - GET /menu           tenant from host / X-Tenant / ?tenant= (`tenant` middleware)
 *  - GET /menu/{qrToken} tenant + table resolved from the scanned QR token (M3)
 * Reads the cached nutrition summary — never a live calculation (docs/03 §3.3).
 */
class MenuController extends Controller
{
    use ResolvesQrToken;

    public function __construct(protected TenantManager $tenants) {}

    /** POST /menu/{qrToken}/view — record a menu/product impression (M9). */
    public function logView(Request $request, string $qrToken): JsonResponse
    {
        [$table] = $this->resolveByToken($qrToken);

        $productId = $request->integer('product_id') ?: null;
        if ($productId && ! \App\Models\Product::whereKey($productId)->exists()) {
            $productId = null;
        }

        MenuView::create([
            'branch_id' => $table->branch_id,
            'product_id' => $productId,
            'locale' => $request->query('locale'),
            'viewed_at' => now(),
        ]);

        return response()->json(['data' => ['logged' => true]]);
    }

    /** Tenant already resolved by the `tenant` middleware. */
    public function show(): JsonResponse
    {
        $tenant = $this->tenants->get();
        $branchId = Branch::query()->where('is_active', true)->orderBy('id')->value('id');

        return response()->json(['data' => $this->buildMenu($tenant, $branchId)]);
    }

    /** QR-token entry: resolve the venue + table from an unguessable token. */
    public function showByToken(string $qrToken): JsonResponse
    {
        $table = Table::withoutTenancy()
            ->where('qr_token', $qrToken)
            ->where('is_active', true)
            ->first();

        abort_if($table === null, 404, 'Menu not found.');

        $tenant = Tenant::find($table->tenant_id);
        abort_if($tenant === null || $tenant->status === 'suspended', 404, 'Menu not found.');

        $this->tenants->set($tenant);
        app()->setLocale(request()->query('locale', $tenant->locale_default ?? config('app.locale')));

        $table->loadMissing('diningArea');

        $data = $this->buildMenu($tenant, $table->branch_id);
        $data['table'] = [
            'id' => $table->id,
            'code' => $table->code,
            'qr_token' => $table->qr_token,
            'area_type' => $table->diningArea?->type,
            'is_room' => $table->diningArea?->type === 'room',
        ];

        return response()->json(['data' => $data]);
    }

    /** @return array<string,mixed> */
    protected function buildMenu(Tenant $tenant, ?int $branchId = null): array
    {
        // Products 86'd for this branch are hidden from the menu (docs/06 §6.7).
        $eightySixed = $branchId ? EightySixItem::activeProductIds($branchId) : [];

        $categories = Category::query()
            ->where('is_active', true)
            ->whereNull('parent_id')
            ->with([
                'translations',
                'products' => fn ($q) => $q->where('is_active', true)
                    ->when($eightySixed, fn ($qq) => $qq->whereNotIn('id', $eightySixed))
                    ->orderBy('sort'),
                'products.translations',
                'products.variants',
                'products.modifierGroups.modifiers',
                'products.nutritionSummary',
            ])
            ->orderBy('sort')
            ->get();

        $settings = $tenant->settings_json ?? [];

        return [
            'venue' => [
                'name' => $tenant->name,
                'locale_default' => $tenant->locale_default,
                'currency' => $tenant->currency,
                'sub_title' => $settings['sub_title'] ?? null,
                'timing' => $settings['timing'] ?? null,
                'description' => $settings['description'] ?? null,
                'address' => $settings['address'] ?? null,
                'logo' => $settings['logo'] ?? null,
                'cover' => $settings['cover'] ?? null,
                'theme' => $settings['theme'] ?? 'classic',
                'vertical' => \App\Support\Restaurant\RestaurantSettings::vertical($settings),
                'happy_hour' => [
                    'active' => \App\Support\Restaurant\HappyHour::active($settings, null, $tenant->timezone),
                    'percent' => \App\Support\Restaurant\HappyHour::percent($settings, null, $tenant->timezone),
                ],
            ],
            'allergens' => Allergen::orderBy('id')->get(['id', 'code', 'name', 'icon']),
            'categories' => CategoryResource::collection($categories)->resolve(),
        ];
    }
}
