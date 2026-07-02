<?php

use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\DiningAreaController;
use App\Http\Controllers\Api\Admin\IngredientController;
use App\Http\Controllers\Api\Admin\ProductController;
use App\Http\Controllers\Api\Admin\RecipeController;
use App\Http\Controllers\Api\Admin\TableController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\TenantController;
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

// --- Public menu (M1/M4) — tenant resolved from host / X-Tenant (docs/06 §6.2) ---
Route::middleware('tenant')->group(function () {
    Route::get('menu', [MenuController::class, 'show']);
});

// --- Public QR menu + session (M3, docs/06 §6.2/§6.3) — tenant from token ---
Route::get('menu/{qrToken}', [MenuController::class, 'showByToken']);
Route::post('sessions/{qrToken}/open', [SessionController::class, 'open'])->middleware('throttle:30,1');

// --- Authenticated (any signed-in user) --------------------------------------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/2fa/verify', [AuthController::class, 'verifyTwoFactor']);

    // Tenant-scoped: binds the active tenant from the signed-in user.
    Route::middleware('tenant.user')->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);

        Route::get('tenant', [TenantController::class, 'show']);
        Route::patch('tenant', [TenantController::class, 'update'])->middleware('role:manager');

        // --- Menu & recipe management (M1/M2, docs/06 §6.5/§6.6) — manager+ ---
        Route::middleware('role:manager')->group(function () {
            Route::apiResource('admin/categories', CategoryController::class)
                ->only(['index', 'store', 'update', 'destroy']);

            Route::apiResource('admin/products', ProductController::class)
                ->only(['index', 'show', 'store', 'update', 'destroy']);

            Route::apiResource('admin/ingredients', IngredientController::class)
                ->only(['index', 'store', 'update', 'destroy']);

            Route::get('admin/products/{product}/recipe', [RecipeController::class, 'show']);
            Route::put('admin/products/{product}/recipe', [RecipeController::class, 'update']);
            Route::get('admin/products/{product}/nutrition', [RecipeController::class, 'nutrition']);
            Route::post('admin/products/{product}/nutrition/recompute', [RecipeController::class, 'recompute']);

            // QR & tables (M3)
            Route::apiResource('admin/dining-areas', DiningAreaController::class)
                ->only(['index', 'store', 'update', 'destroy']);
            Route::post('admin/tables/bulk', [TableController::class, 'bulk']);
            Route::post('admin/tables/{table}/regenerate-token', [TableController::class, 'regenerate']);
            Route::apiResource('admin/tables', TableController::class)
                ->only(['index', 'store', 'update', 'destroy']);
        });
    });
});
