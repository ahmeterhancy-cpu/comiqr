<?php

use App\Http\Controllers\Api\AuthController;
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

// --- Authenticated (any signed-in user) --------------------------------------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/2fa/verify', [AuthController::class, 'verifyTwoFactor']);

    // Tenant-scoped: binds the active tenant from the signed-in user.
    Route::middleware('tenant.user')->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);

        Route::get('tenant', [TenantController::class, 'show']);
        Route::patch('tenant', [TenantController::class, 'update'])->middleware('role:manager');
    });
});
