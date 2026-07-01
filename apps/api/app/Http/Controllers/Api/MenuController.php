<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;

/**
 * Public menu (M1/M4, docs/06 §6.2). Tenant is resolved from the host / X-Tenant
 * header by the `tenant` middleware; the QR-token route (M3) will front this.
 * Reads the cached nutrition summary — never a live calculation (docs/03 §3.3).
 */
class MenuController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    public function show(): JsonResponse
    {
        $tenant = $this->tenants->get();

        $categories = Category::query()
            ->where('is_active', true)
            ->whereNull('parent_id')
            ->with([
                'translations',
                'products' => fn ($q) => $q->where('is_active', true)->orderBy('sort'),
                'products.translations',
                'products.variants',
                'products.nutritionSummary',
            ])
            ->orderBy('sort')
            ->get();

        return response()->json([
            'data' => [
                'venue' => [
                    'name' => $tenant->name,
                    'locale_default' => $tenant->locale_default,
                    'currency' => $tenant->currency,
                ],
                'categories' => CategoryResource::collection($categories),
            ],
        ]);
    }
}
