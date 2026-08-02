<?php

use App\Enums\Role;
use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function financeManager(?Tenant $tenant = null): Tenant
{
    $tenant ??= Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    return $tenant;
}

it('records an expense and totals it in the list', function () {
    $tenant = financeManager();
    $category = app(TenantManager::class)->runAs($tenant, fn () => ExpenseCategory::factory()->create(['name' => 'Kira']));

    postJson('/v1/admin/expenses', [
        'description' => 'Dükkân kirası',
        'amount' => 15000,
        'tax_amount' => 3000,
        'payment_method' => 'transfer',
        'spent_on' => now()->toDateString(),
        'expense_category_id' => $category->id,
    ])->assertCreated()->assertJsonPath('data.description', 'Dükkân kirası');

    getJson('/v1/admin/expenses')
        ->assertOk()
        ->assertJsonPath('meta.total', 15000)
        ->assertJsonPath('meta.tax_total', 3000)
        ->assertJsonPath('meta.count', 1);
});

it('posts a payable to the supplier ledger for a credit-term expense', function () {
    $tenant = financeManager();
    $supplier = app(TenantManager::class)->runAs($tenant, fn () => Account::factory()->create(['name' => 'Et Toptancısı']));

    postJson('/v1/admin/expenses', [
        'description' => 'Kıyma alımı',
        'amount' => 4000,
        'tax_amount' => 400,
        'payment_method' => 'credit',
        'spent_on' => now()->toDateString(),
        'account_id' => $supplier->id,
    ])->assertCreated();

    // Negatif bakiye = biz borçluyuz (KDV dahil ödenecek tutar).
    expect((float) $supplier->fresh()->balance)->toBe(-4400.0);

    app(TenantManager::class)->runAs($tenant, function () use ($supplier) {
        $ledger = AccountTransaction::where('account_id', $supplier->id)->get();
        expect($ledger)->toHaveCount(1);
        expect($ledger->first()->type)->toBe('purchase');
    });
});

it('rewrites the payable when the expense is edited, and clears it when deleted', function () {
    $tenant = financeManager();
    $supplier = app(TenantManager::class)->runAs($tenant, fn () => Account::factory()->create());

    $id = postJson('/v1/admin/expenses', [
        'description' => 'Sebze',
        'amount' => 1000,
        'payment_method' => 'credit',
        'spent_on' => now()->toDateString(),
        'account_id' => $supplier->id,
    ])->assertCreated()->json('data.id');

    expect((float) $supplier->fresh()->balance)->toBe(-1000.0);

    // Tutar düzeltildi → defter satırı yeniden yazılır, iki kez borçlanmaz.
    patchJson("/v1/admin/expenses/{$id}", ['amount' => 1500])->assertOk();
    expect((float) $supplier->fresh()->balance)->toBe(-1500.0);

    // Peşine çevrildi → tedarikçi borcu kalkar.
    patchJson("/v1/admin/expenses/{$id}", ['payment_method' => 'cash'])->assertOk();
    expect((float) $supplier->fresh()->balance)->toBe(0.0);

    patchJson("/v1/admin/expenses/{$id}", ['payment_method' => 'credit'])->assertOk();
    expect((float) $supplier->fresh()->balance)->toBe(-1500.0);

    deleteJson("/v1/admin/expenses/{$id}")->assertOk();
    expect((float) $supplier->fresh()->balance)->toBe(0.0);
});

it('never shows or touches another tenant\'s expenses', function () {
    $other = Tenant::factory()->create();
    $otherExpense = app(TenantManager::class)->runAs(
        $other,
        fn () => Expense::factory()->create(['description' => 'Komşunun gideri']),
    );

    financeManager();

    getJson('/v1/admin/expenses')->assertOk()->assertJsonPath('meta.count', 0);
    patchJson("/v1/admin/expenses/{$otherExpense->id}", ['amount' => 1])->assertNotFound();
    deleteJson("/v1/admin/expenses/{$otherExpense->id}")->assertNotFound();
});

it('rejects a category or account belonging to another tenant', function () {
    $other = Tenant::factory()->create();
    [$otherCategory, $otherAccount] = app(TenantManager::class)->runAs($other, fn () => [
        ExpenseCategory::factory()->create(),
        Account::factory()->create(),
    ]);

    financeManager();

    postJson('/v1/admin/expenses', [
        'description' => 'Sızıntı denemesi',
        'amount' => 10,
        'payment_method' => 'cash',
        'spent_on' => now()->toDateString(),
        'expense_category_id' => $otherCategory->id,
        'account_id' => $otherAccount->id,
    ])->assertStatus(422)->assertJsonValidationErrors(['expense_category_id', 'account_id']);
});

it('keeps expense category names unique per tenant but free across tenants', function () {
    $tenant = financeManager();

    postJson('/v1/admin/expense-categories', ['name' => 'Enerji'])->assertCreated();
    postJson('/v1/admin/expense-categories', ['name' => 'Enerji'])
        ->assertStatus(422)->assertJsonValidationErrors('name');

    financeManager(Tenant::factory()->create());
    postJson('/v1/admin/expense-categories', ['name' => 'Enerji'])->assertCreated();

    expect($tenant)->not->toBeNull();
});

it('is closed to non-managers', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    getJson('/v1/admin/expenses')->assertForbidden();
    getJson('/v1/admin/accounts')->assertForbidden();
    getJson('/v1/admin/reports/profit-loss')->assertForbidden();
});
