<?php

use App\Http\Controllers\Api\Admin\AccountController;
use App\Http\Controllers\Api\Admin\AiController;
use App\Http\Controllers\Api\Admin\AnalyticsController;
use App\Http\Controllers\Api\Admin\BranchController;
use App\Http\Controllers\Api\Admin\CampaignController;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\CouponController;
use App\Http\Controllers\Api\Admin\CustomerController;
use App\Http\Controllers\Api\Admin\DiningAreaController;
use App\Http\Controllers\Api\Admin\ExpenseCategoryController;
use App\Http\Controllers\Api\Admin\ExpenseController;
use App\Http\Controllers\Api\Admin\FinanceReportController;
use App\Http\Controllers\Api\Admin\IngredientController;
use App\Http\Controllers\Api\Admin\IntegrationController;
use App\Http\Controllers\Api\Admin\MenuPdfController;
use App\Http\Controllers\Api\Admin\ModifierGroupController;
use App\Http\Controllers\Api\Admin\PosController;
use App\Http\Controllers\Api\Admin\PosShiftController;
use App\Http\Controllers\Api\Admin\PrinterController;
use App\Http\Controllers\Api\Admin\ProductController;
use App\Http\Controllers\Api\Admin\ProductMediaController;
use App\Http\Controllers\Api\Admin\ProductVariantController;
use App\Http\Controllers\Api\Admin\RecipeController;
use App\Http\Controllers\Api\Admin\RestaurantMediaController;
use App\Http\Controllers\Api\Admin\StockController;
use App\Http\Controllers\Api\Admin\TableController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DiscoveryController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\HotelController;
use App\Http\Controllers\Api\KdsController;
use App\Http\Controllers\Api\MarketplaceOrderController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\LandingController;
use App\Http\Controllers\Api\SuperadminController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\WaiterController;
use App\Models\Allergen;
use App\Models\Plan;
use App\Support\Tenancy\SlugGenerator;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

/*
|--------------------------------------------------------------------------
| API v1 (docs/06). Base path prefix `v1` is set in bootstrap/app.php.
| Tenant is resolved either from the signed-in user (`tenant.user`) or, for
| public QR/menu endpoints, from the host/token (`tenant`). See docs/04 §4.2.
|--------------------------------------------------------------------------
*/

// --- Public / central (no tenant) --------------------------------------------
Route::get('ping', fn () => response()->json(['data' => ['ok' => true, 'app' => config('app.name')]]));

// A4: readiness probe — DB + cache reachability for load balancers / uptime checks.
Route::get('health', HealthController::class);

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
    abort_unless(Storage::disk('public')->exists($path), 404);

    return Storage::disk('public')->response($path);
})->where('path', '.*');

// --- Public SaaS plans (onboarding plan picker) — code/price/verticals ---
Route::get('plans', function () {
    return response()->json(['data' => Plan::where('is_active', true)->orderBy('sort')->get()
        ->map(fn ($p) => [
            'code' => $p->code,
            'name' => $p->name,
            'price_monthly' => $p->price_monthly,
            'price_yearly' => $p->price_yearly,
            'currency' => $p->currency,
            'verticals' => data_get($p->features_json, 'verticals', ['restaurant']),
            'features' => $p->features_json,
            'limits' => $p->limits_json,
        ])]);
})->middleware('throttle:60,1');

// --- Public landing content (süperadmin panelden yönetilir) ---
// Yalnız üzerine yazılan alanlar döner; varsayılan metin sayfayı basan tarafta.
Route::get('landing', [LandingController::class, 'show'])->middleware('throttle:120,1');

// --- Public consumer discovery portal (M20) — central, tenant-less ---
Route::get('discover', [DiscoveryController::class, 'index'])->middleware('throttle:120,1');

// --- Marketplace / menu package-service ordering (M20) — venue by slug ---
Route::post('venues/{slug}/orders', [MarketplaceOrderController::class, 'place'])->middleware('throttle:30,1');
Route::get('venues/{slug}/cards', [MarketplaceOrderController::class, 'cards'])->middleware('throttle:60,1');
Route::get('venues/{slug}/reviews', [ReviewController::class, 'venueReviews'])->middleware('throttle:120,1');

// --- Public menu (M1/M4) — tenant resolved from host / X-Tenant (docs/06 §6.2) ---
Route::middleware('tenant')->group(function () {
    Route::get('menu', [MenuController::class, 'show']);
    Route::post('menu/chat', [MenuController::class, 'chat'])->middleware('throttle:20,1');
    // Service calls from the slug menu (no scanned token): customer picks a table code.
    Route::post('service/call-waiter', [SessionController::class, 'callWaiterByCode'])->middleware('throttle:20,1');
    Route::post('service/request-bill', [SessionController::class, 'requestBillByCode'])->middleware('throttle:20,1');
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
    Route::post('orders/{order}/charge-to-room', [OrderController::class, 'chargeToRoom'])->middleware('throttle:20,1');
    Route::post('orders/{order}/review', [ReviewController::class, 'store'])->middleware('throttle:20,1');
    Route::post('orders/{order}/pay', [PaymentController::class, 'pay'])->middleware('throttle:30,1');
});

// --- Payment webhooks (M5, docs/06 §6.4) — public, signature-verified ---
Route::post('payments/webhook/{gateway}', [PaymentController::class, 'webhook']);

// --- Recurring SaaS subscription result (Tiko) — public; past_due + grace on failure ---
Route::post('webhooks/tiko/recurring', [SubscriptionController::class, 'webhook'])->middleware('throttle:120,1');

// --- 3D Secure browser return (Tiko UrlOk/UrlFail) — verify + confirm + redirect ---
Route::match(['get', 'post'], 'payments/return/{gateway}', [PaymentController::class, 'paymentReturn']);

// --- Subscription card 3DS browser return (Tiko) — verify + activate + store card ---
Route::match(['get', 'post'], 'subscription/return/tiko', [SubscriptionController::class, 'paymentReturn']);

// --- Authenticated (any signed-in user) --------------------------------------
Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    // Current user — available to ANY authenticated user (incl. superadmins, who have
    // no tenant), so it must sit OUTSIDE the fail-closed tenant.user group below.
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/2fa/enable', [AuthController::class, 'enableTwoFactor']);
    Route::post('auth/2fa/confirm', [AuthController::class, 'confirmTwoFactor']);
    Route::post('auth/2fa/verify', [AuthController::class, 'verifyTwoFactor']);
    Route::post('auth/2fa/disable', [AuthController::class, 'disableTwoFactor']);

    // --- Platform superadmin (M12, docs/06 §6.11) — no tenant context ---
    Route::middleware('superadmin')->prefix('superadmin')->group(function () {
        Route::get('overview', [SuperadminController::class, 'overview']);
        Route::get('transactions', [SuperadminController::class, 'transactions']);
        Route::get('plans', [SuperadminController::class, 'plans']);
        Route::patch('plans/{id}', [SuperadminController::class, 'updatePlan']);
        Route::get('allergens', [SuperadminController::class, 'allergens']);
        Route::post('allergens', [SuperadminController::class, 'storeAllergen']);
        Route::patch('allergens/{id}', [SuperadminController::class, 'updateAllergen']);
        Route::delete('allergens/{id}', [SuperadminController::class, 'deleteAllergen']);
        Route::get('users', [SuperadminController::class, 'userSearch']);
        Route::post('users', [SuperadminController::class, 'createUser']);
        Route::patch('users/{id}', [SuperadminController::class, 'updateUser']);
        Route::delete('users/{id}', [SuperadminController::class, 'deleteUser']);
        Route::get('tenants', [SuperadminController::class, 'tenants']);
        Route::get('tenants/{id}', [SuperadminController::class, 'tenantDetail']);
        Route::patch('tenants/{id}', [SuperadminController::class, 'updateTenant']);
        Route::delete('tenants/{id}', [SuperadminController::class, 'deleteTenant']);
        Route::patch('tenants/{id}/restaurant', [SuperadminController::class, 'updateRestaurant']);
        Route::post('tenants/{id}/impersonate', [SuperadminController::class, 'impersonate']);
        Route::post('tenants/{id}/subscription', [SuperadminController::class, 'startSubscription']);
        Route::get('audit-logs', [SuperadminController::class, 'auditLogs']);
        Route::get('menu-model-demos', [SuperadminController::class, 'menuModelDemos']);
        Route::get('landing/{locale}', [LandingController::class, 'edit']);
        Route::put('landing/{locale}', [LandingController::class, 'update']);
        Route::post('landing-media', [LandingController::class, 'uploadMedia']);
        Route::delete('landing-media/{slot}', [LandingController::class, 'deleteMedia']);
    });

    // Tenant-scoped: binds the active tenant from the signed-in user.
    Route::middleware('tenant.user')->group(function () {
        Route::get('tenant', [TenantController::class, 'show']);
        Route::patch('tenant', [TenantController::class, 'update'])->middleware('role:manager');
        Route::post('tenant/region', [TenantController::class, 'region'])->middleware('role:manager');
        Route::post('tenant/media', [RestaurantMediaController::class, 'upload'])->middleware('role:manager');

        // Owner self-serve SaaS subscription (Tiko recurring) — manager+.
        Route::get('subscription', [SubscriptionController::class, 'show']);
        Route::post('subscription', [SubscriptionController::class, 'start'])->middleware('role:manager');

        // Staff / sub-users — owner & managers manage tenant users (manager+).
        Route::middleware('role:manager')->group(function () {
            Route::get('staff', [StaffController::class, 'index']);
            Route::post('staff', [StaffController::class, 'store']);
            Route::patch('staff/{id}', [StaffController::class, 'update']);
            Route::delete('staff/{id}', [StaffController::class, 'destroy']);
        });

        // --- Menu & recipe management (M1/M2, docs/06 §6.5/§6.6) — manager+ ---
        Route::middleware('role:manager')->group(function () {
            // Baskıya hazır menü PDF'i (dompdf) — tek-tık indirme.
            Route::get('admin/menu/pdf', [MenuPdfController::class, 'download'])->middleware('throttle:30,1');

            Route::apiResource('admin/branches', BranchController::class)
                ->only(['index', 'store', 'update', 'destroy']);
            Route::get('admin/allergens', fn () => response()->json([
                'data' => Allergen::orderBy('id')->get(['id', 'code', 'name']),
            ]));

            Route::post('admin/categories/reorder', [CategoryController::class, 'reorder']);
            Route::post('admin/categories/media', [CategoryController::class, 'uploadMedia']);
            Route::apiResource('admin/categories', CategoryController::class)
                ->only(['index', 'store', 'update', 'destroy']);

            Route::post('admin/products/reorder', [ProductController::class, 'reorder']);
            Route::apiResource('admin/products', ProductController::class)
                ->only(['index', 'show', 'store', 'update', 'destroy']);
            Route::post('admin/products/{product}/media', [ProductMediaController::class, 'upload']);
            Route::delete('admin/products/{product}/media', [ProductMediaController::class, 'destroy']);
            Route::post('admin/products/{product}/variants', [ProductVariantController::class, 'store']);
            Route::patch('admin/products/{product}/variants/{variant}', [ProductVariantController::class, 'update']);
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

            // Hotel/beach vertical (Faz 3) — room/sunbed folio + check-out settle. Plan-gated.
            Route::middleware('plan:folio')->group(function () {
                Route::get('admin/hotel/folio', [HotelController::class, 'folio']);
                Route::post('admin/hotel/rooms/{table}/settle', [HotelController::class, 'settle']);
            });

            // Printer routing (Faz 4) — which product group prints where. Plan-gated.
            Route::middleware('plan:printing')->group(function () {
                Route::apiResource('admin/printers', PrinterController::class)
                    ->only(['index', 'store', 'update', 'destroy']);
                Route::post('admin/printers/{printer}/test', [PrinterController::class, 'test'])
                    ->middleware('throttle:20,1');
                Route::get('admin/print-jobs', [PrinterController::class, 'jobs']);
                Route::post('admin/print-jobs/{job}/retry', [PrinterController::class, 'retry'])
                    ->middleware('throttle:60,1');
            });

            // Reviews (Faz 3) — list + reputation, reply, moderate.
            Route::get('admin/reviews', [ReviewController::class, 'index']);
            Route::post('admin/reviews/{review}/reply', [ReviewController::class, 'reply']);
            Route::post('admin/reviews/{review}/status', [ReviewController::class, 'setStatus']);
        });

        // --- POS terminal reads — the cashier/waiter role has no menu-editing rights
        // but needs to read the product grid, categories, branches and tables to build
        // a ticket. Registered AFTER the manager group so these GETs resolve here
        // (Laravel keeps the last-registered route per method+URI); gated
        // role:manager,cashier,waiter — the waiter app bridges into /pos to take
        // orders (the write path stays plan:ordering-gated). Deliberately NOT
        // plan-gated so a manager on any plan keeps read access. ---
        Route::middleware('role:manager,cashier,waiter')->group(function () {
            Route::get('admin/products', [ProductController::class, 'index']);
            Route::get('admin/products/{product}', [ProductController::class, 'show']);
            Route::get('admin/categories', [CategoryController::class, 'index']);
            Route::get('admin/branches', [BranchController::class, 'index']);
            Route::get('admin/tables', [TableController::class, 'index']);
            Route::get('admin/customers', [CustomerController::class, 'index']);
        });

        // --- Staff POS (Faz 3 — ultra POS) — waiter+ or cashier, ordering plan ---
        Route::middleware(['role:waiter,cashier', 'plan:ordering'])->group(function () {
            Route::get('admin/pos/orders', [PosController::class, 'orders']);
            Route::post('admin/pos/orders', [PosController::class, 'order'])->middleware('throttle:120,1');
            Route::post('admin/pos/orders/{order}/items', [PosController::class, 'addItems'])->middleware('throttle:120,1');
            Route::post('admin/pos/orders/{order}/items/{item}/void', [PosController::class, 'voidItem'])->middleware('throttle:120,1');
            Route::post('admin/pos/orders/{order}/items/{item}/discount', [PosController::class, 'lineDiscount'])->middleware('throttle:120,1');
            Route::post('admin/pos/orders/{order}/discount', [PosController::class, 'discount'])->middleware('throttle:120,1');
            Route::post('admin/pos/orders/{order}/charge-to-room', [PosController::class, 'chargeRoom'])->middleware('throttle:120,1');
            Route::post('admin/pos/orders/{order}/pay', [PosController::class, 'pay'])->middleware('throttle:120,1');
            Route::post('admin/pos/orders/{order}/refund', [PosController::class, 'refund'])->middleware('throttle:120,1');
            Route::post('admin/pos/orders/{order}/redeem', [PosController::class, 'redeem'])->middleware('throttle:120,1');
            // Veresiye — needs the finance module on top of ordering.
            Route::post('admin/pos/orders/{order}/charge-account', [PosController::class, 'chargeAccount'])
                ->middleware(['plan:finance', 'throttle:120,1']);
            Route::post('admin/pos/orders/{order}/service-charge', [PosController::class, 'serviceCharge'])->middleware('throttle:120,1');

            // Cash-drawer shift (Z-report).
            Route::get('admin/pos/shift/current', [PosShiftController::class, 'current']);
            Route::post('admin/pos/shift/open', [PosShiftController::class, 'open'])->middleware('throttle:60,1');
            Route::post('admin/pos/shift/{shift}/close', [PosShiftController::class, 'close'])->middleware('throttle:60,1');
        });

        // --- Finance (Faz 4 — gider · cari · maliyet-kâr) — manager+, plan-gated ---
        Route::middleware(['role:manager', 'plan:finance'])->group(function () {
            Route::apiResource('admin/expense-categories', ExpenseCategoryController::class)
                ->only(['index', 'store', 'update', 'destroy'])
                ->parameters(['expense-categories' => 'category']);

            Route::apiResource('admin/expenses', ExpenseController::class)
                ->only(['index', 'store', 'update', 'destroy']);

            // Cari hesaplar + defter. The ledger POST is the tahsilat/ödeme entry.
            Route::get('admin/accounts/{account}/transactions', [AccountController::class, 'transactions']);
            Route::post('admin/accounts/{account}/transactions', [AccountController::class, 'storeTransaction'])
                ->middleware('throttle:60,1');
            Route::apiResource('admin/accounts', AccountController::class)
                ->only(['index', 'show', 'store', 'update', 'destroy']);

            Route::get('admin/reports/profit-loss', [FinanceReportController::class, 'profitLoss']);
            Route::get('admin/reports/profit-loss.csv', [FinanceReportController::class, 'profitLossCsv'])
                ->middleware('throttle:20,1');
            Route::get('admin/reports/accounts', [FinanceReportController::class, 'accounts']);
            Route::get('admin/reports/cockpit', [FinanceReportController::class, 'cockpit']);
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
            Route::post('admin/ai/import-menu', [AiController::class, 'importMenu'])->middleware('throttle:6,1');
        });

        // --- AI ileri (Faz 3) — advisor: menu insights + review summary ---
        Route::middleware(['role:manager', 'plan:ai_advanced'])->group(function () {
            Route::post('admin/ai/menu-insights', [AiController::class, 'menuInsights'])->middleware('throttle:10,1');
            Route::post('admin/ai/review-summary', [AiController::class, 'reviewSummary'])->middleware('throttle:10,1');
        });

        // --- CRM / loyalty / coupons (M8) — manager+ ---
        Route::middleware('role:manager')->group(function () {
            Route::get('admin/customers', [CustomerController::class, 'index']);

            // Coupons + campaigns are the loyalty/CRM module — plan:loyalty.
            Route::middleware('plan:loyalty')->group(function () {
                Route::apiResource('admin/coupons', CouponController::class)
                    ->only(['index', 'store', 'update', 'destroy']);

                Route::apiResource('admin/campaigns', CampaignController::class)
                    ->only(['index', 'store', 'destroy']);
                Route::post('admin/campaigns/{campaign}/send', [CampaignController::class, 'send'])
                    ->middleware('throttle:10,1');
            });

            // External integrations (POS/ÖKC/ERP/delivery) — plan:pos_integration.
            Route::middleware('plan:pos_integration')->group(function () {
                Route::apiResource('admin/integrations', IntegrationController::class)
                    ->only(['index', 'store', 'update', 'destroy']);
                Route::post('admin/integrations/{integration}/test', [IntegrationController::class, 'test'])
                    ->middleware('throttle:20,1');
            });
        });

        // --- Waiter (M10, docs/06 §6.8) — waiter+, plan-gated ---
        Route::middleware(['role:waiter', 'plan:waiter_app'])->group(function () {
            Route::get('waiter/tables', [WaiterController::class, 'tables']);
            Route::get('waiter/notifications', [WaiterController::class, 'notifications']);
            Route::post('waiter/order-items/{item}/served', [WaiterController::class, 'served']);
            Route::post('waiter/sessions/{session}/ack', [WaiterController::class, 'acknowledge']);
        });

        // --- Print bridge (Faz 4) — the small agent on the venue's network polls
        // its printer's queue and reports back. Kitchen+ so it can run under a
        // station account rather than a manager's credentials. ---
        Route::middleware(['role:kitchen', 'plan:printing'])->group(function () {
            Route::get('admin/print-jobs/pending', [PrinterController::class, 'pending']);
            Route::post('admin/print-jobs/{job}/ack', [PrinterController::class, 'ack'])
                ->middleware('throttle:300,1');
        });

        // --- KDS (M6, docs/06 §6.7) — kitchen+, plan-gated ---
        Route::middleware(['role:kitchen', 'plan:kds'])->group(function () {
            Route::get('kds/{branch}/orders', [KdsController::class, 'orders']);
            Route::post('kds/order-items/{item}/status', [KdsController::class, 'status']);
            Route::post('kds/order-items/{item}/bump', [KdsController::class, 'bump']);
            Route::post('kds/eighty-six', [KdsController::class, 'eightySix']);
            Route::delete('kds/eighty-six/{id}', [KdsController::class, 'removeEightySix']);
        });
    });
});
