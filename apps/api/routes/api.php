<?php

use App\Http\Controllers\Api\Admin\AiController;
use App\Http\Controllers\Api\Admin\AnalyticsController;
use App\Http\Controllers\Api\Admin\BranchController;
use App\Http\Controllers\Api\Admin\CampaignController;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\CouponController;
use App\Http\Controllers\Api\Admin\CustomerController;
use App\Http\Controllers\Api\Admin\DiningAreaController;
use App\Http\Controllers\Api\Admin\IngredientController;
use App\Http\Controllers\Api\Admin\ModifierGroupController;
use App\Http\Controllers\Api\Admin\ProductController;
use App\Http\Controllers\Api\Admin\ProductMediaController;
use App\Http\Controllers\Api\Admin\ProductVariantController;
use App\Http\Controllers\Api\Admin\RecipeController;
use App\Http\Controllers\Api\Admin\StockController;
use App\Http\Controllers\Api\Admin\TableController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\KdsController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\SuperadminController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\WaiterController;
use App\Support\Tenancy\SlugGenerator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1 (docs/06). Base path prefix `v1` is set in bootstrap/app.php.
| Tenant is resolved either from the signed-in user (`tenant.user`) or, for
| public QR/menu endpoints, from the host/token (`tenant`). See docs/04 §4.2.
|--------------------------------------------------------------------------
*/

// --- Public / central (no tenant) --------------------------------------------
Route::get('ping', fn () => response()->json(['data' => ['ok' => true, 'app' => config('app.name')]]));

Route::post('auth/register-tenant', [AuthController::class, 'registerTenant'])
    ->middleware('throttle:onboarding');

Route::post('auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::get('auth/slug-available/{slug}', function (string $slug, SlugGenerator $slugs) {
    return response()->json(['data' => [
        'slug' => $slug,
        'available' => $slugs->isAvailable($slug),
        'reserved' => $slugs->isReserved($slug),
    ]]);
})->middleware('throttle:60,1');

// --- Public media (product images) ---
Route::get('media/{path}', function (string $path) {
    abort_unless(\Illuminate\Support\Facades\Storage::disk('public')->exists($path), 404);

    return \Illuminate\Support\Facades\Storage::disk('public')->response($path);
})->where('path', '.*');

// --- Public menu (M1/M4) — tenant resolved from host / X-Tenant (docs/06 §6.2) ---
Route::middleware('tenant')->group(function () {
    Route::get('menu', [MenuController::class, 'show']);
});

// --- Public QR menu + session + ordering (M3/M4) — tenant from token ---
Route::get('menu/{qrToken}', [MenuController::class, 'showByToken']);
Route::post('menu/{qrToken}/view', [MenuController::class, 'logView'])->middleware('throttle:120,1');

Route::prefix('sessions/{qrToken}')->group(function () {
    Route::post('open', [SessionController::class, 'open'])->middleware('throttle:30,1');
    Route::post('call-waiter', [SessionController::class, 'callWaiter'])->middleware('throttle:20,1');
    Route::post('request-bill', [SessionController::class, 'requestBill'])->middleware('throttle:20,1');

    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'place'])->middleware('throttle:60,1');
    Route::get('orders/{order}', [OrderController::class, 'show']);
    Route::post('orders/{order}/items', [OrderController::class, 'addItems'])->middleware('throttle:60,1');
    Route::post('orders/{order}/apply-coupon', [OrderController::class, 'applyCoupon'])->middleware('throttle:20,1');
    Route::post('orders/{order}/pay', [PaymentController::class, 'pay'])->middleware('throttle:30,1');
});

// --- Payment webhooks (M5, docs/06 §6.4) — public, signature-verified ---
Route::post('payments/webhook/{gateway}', [PaymentController::class, 'webhook']);

// --- Authenticated (any signed-in user) --------------------------------------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/2fa/verify', [AuthController::class, 'verifyTwoFactor']);

    // --- Platform superadmin (M12, docs/06 §6.11) — no tenant context ---
    Route::middleware('superadmin')->prefix('superadmin')->group(function () {
        Route::get('tenants', [SuperadminController::class, 'tenants']);
        Route::patch('tenants/{id}', [SuperadminController::class, 'updateTenant']);
        Route::post('tenants/{id}/impersonate', [SuperadminController::class, 'impersonate']);
        Route::get('audit-logs', [SuperadminController::class, 'auditLogs']);
    });

    // Tenant-scoped: binds the active tenant from the signed-in user.
    Route::middleware('tenant.user')->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);

        Route::get('tenant', [TenantController::class, 'show']);
        Route::patch('tenant', [TenantController::class, 'update'])->middleware('role:manager');

        // --- Menu & recipe management (M1/M2, docs/06 §6.5/§6.6) — manager+ ---
        Route::middleware('role:manager')->group(function () {
            Route::apiResource('admin/branches', BranchController::class)
                ->only(['index', 'store', 'update', 'destroy']);
            Route::get('admin/allergens', fn () => response()->json([
                'data' => \App\Models\Allergen::orderBy('id')->get(['id', 'code', 'name']),
            ]));

            Route::apiResource('admin/categories', CategoryController::class)
                ->only(['index', 'store', 'update', 'destroy']);

            Route::apiResource('admin/products', ProductController::class)
                ->only(['index', 'show', 'store', 'update', 'destroy']);
            Route::post('admin/products/{product}/media', [ProductMediaController::class, 'upload']);
            Route::delete('admin/products/{product}/media', [ProductMediaController::class, 'destroy']);
            Route::post('admin/products/{product}/variants', [ProductVariantController::class, 'store']);
            Route::delete('admin/products/{product}/variants/{variant}', [ProductVariantController::class, 'destroy']);

            // Modifier groups (M1) — reusable option sets + product attachment.
            Route::apiResource('admin/modifier-groups', ModifierGroupController::class)
                ->only(['index', 'store', 'update', 'destroy']);
            Route::post('admin/modifier-groups/{group}/modifiers', [ModifierGroupController::class, 'storeModifier']);
            Route::delete('admin/modifier-groups/{group}/modifiers/{modifier}', [ModifierGroupController::class, 'destroyModifier']);
            Route::post('admin/products/{product}/modifier-groups', [ModifierGroupController::class, 'attach']);
            Route::delete('admin/products/{product}/modifier-groups/{group}', [ModifierGroupController::class, 'detach']);

            Route::apiResource('admin/ingredients', IngredientController::class)
                ->only(['index', 'store', 'update', 'destroy']);

            Route::get('admin/products/{product}/recipe', [RecipeController::class, 'show']);
            Route::put('admin/products/{product}/recipe', [RecipeController::class, 'update']);
            Route::get('admin/products/{product}/nutrition', [RecipeController::class, 'nutrition']);
            Route::post('admin/products/{product}/nutrition/recompute', [RecipeController::class, 'recompute']);

            // Inventory / stock (Faz 2, M18)
            Route::post('admin/stock-movements', [StockController::class, 'move']);
            Route::get('admin/inventory/low-stock', [StockController::class, 'lowStock']);

            // QR & tables (M3)
            Route::apiResource('admin/dining-areas', DiningAreaController::class)
                ->only(['index', 'store', 'update', 'destroy']);
            Route::post('admin/tables/bulk', [TableController::class, 'bulk']);
            Route::post('admin/tables/{table}/regenerate-token', [TableController::class, 'regenerate']);
            Route::apiResource('admin/tables', TableController::class)
                ->only(['index', 'store', 'update', 'destroy']);
        });

        // --- Analytics (M9) — manager+, plan-gated ---
        Route::middleware(['role:manager', 'plan:analytics'])->group(function () {
            Route::get('admin/analytics/overview', [AnalyticsController::class, 'overview']);
            Route::get('admin/analytics/heatmap', [AnalyticsController::class, 'heatmap']);
        });

        // --- AI menu tasks (M7) — manager+, plan-gated ---
        Route::middleware(['role:manager', 'plan:ai'])->group(function () {
            Route::post('admin/ai/product-copy', [AiController::class, 'productCopy'])->middleware('throttle:30,1');
            Route::post('admin/ai/translate-menu', [AiController::class, 'translateMenu'])->middleware('throttle:10,1');
        });

        // --- CRM / loyalty / coupons (M8) — manager+ ---
        Route::middleware('role:manager')->group(function () {
            Route::get('admin/customers', [CustomerController::class, 'index']);
            Route::apiResource('admin/coupons', CouponController::class)
                ->only(['index', 'store', 'update', 'destroy']);

            // Campaigns (M8) — draft + send over the abstract channel.
            Route::apiResource('admin/campaigns', CampaignController::class)
                ->only(['index', 'store', 'destroy']);
            Route::post('admin/campaigns/{campaign}/send', [CampaignController::class, 'send'])
                ->middleware('throttle:10,1');
        });

        // --- Waiter (M10, docs/06 §6.8) — waiter+ ---
        Route::middleware('role:waiter')->group(function () {
            Route::get('waiter/tables', [WaiterController::class, 'tables']);
            Route::get('waiter/notifications', [WaiterController::class, 'notifications']);
            Route::post('waiter/order-items/{item}/served', [WaiterController::class, 'served']);
            Route::post('waiter/sessions/{session}/ack', [WaiterController::class, 'acknowledge']);
        });

        // --- KDS (M6, docs/06 §6.7) — kitchen+ ---
        Route::middleware('role:kitchen')->group(function () {
            Route::get('kds/{branch}/orders', [KdsController::class, 'orders']);
            Route::post('kds/order-items/{item}/status', [KdsController::class, 'status']);
            Route::post('kds/order-items/{item}/bump', [KdsController::class, 'bump']);
            Route::post('kds/eighty-six', [KdsController::class, 'eightySix']);
            Route::delete('kds/eighty-six/{id}', [KdsController::class, 'removeEightySix']);
        });
    });
});
