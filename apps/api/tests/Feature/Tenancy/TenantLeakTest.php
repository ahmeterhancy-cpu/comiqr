<?php

use App\Enums\Role;
use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;

uses(RefreshDatabase::class);

/** A superadmin's own token carries no tenant → tenant-scoped admin routes must fail closed. */
it('denies a superadmin token on tenant-scoped admin routes (no cross-tenant leak)', function () {
    $a = Tenant::factory()->create();
    app(TenantManager::class)->runAs($a, fn () => Product::factory()->forCategory(Category::factory()->create())->create());
    $b = Tenant::factory()->create();
    app(TenantManager::class)->runAs($b, fn () => Product::factory()->forCategory(Category::factory()->create())->create());

    Sanctum::actingAs(User::factory()->superadmin()->create());

    // Previously the global scope no-op'd and these returned BOTH tenants' rows.
    getJson('/v1/admin/products')->assertStatus(403);
    getJson('/v1/admin/categories')->assertStatus(403);
    getJson('/v1/admin/tables')->assertStatus(403);
});

/** Impersonation issues the tenant owner's token, which IS tenant-bound → allowed, scoped. */
it('scopes an impersonation (tenant owner) token to that tenant only', function () {
    $a = Tenant::factory()->create();
    app(TenantManager::class)->runAs($a, fn () => Product::factory()->forCategory(Category::factory()->create())->create(['name' => 'A']));

    $b = Tenant::factory()->create();
    $owner = User::factory()->forTenant($b)->role(Role::Owner)->create();
    app(TenantManager::class)->runAs($b, fn () => Product::factory()->forCategory(Category::factory()->create())->create(['name' => 'B']));

    Sanctum::actingAs($owner);

    getJson('/v1/admin/products')->assertOk()->assertJsonCount(1, 'data'); // only tenant B's product
});
