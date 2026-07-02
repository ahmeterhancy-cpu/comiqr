<?php

use App\Enums\Role;
use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

it('adds and removes product variants (manager)', function () {
    $tenant = Tenant::factory()->create();
    $product = app(TenantManager::class)->runAs($tenant, fn () => Product::factory()
        ->forCategory(Category::factory()->create())->create(['price' => 100]));
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $id = postJson("/v1/admin/products/{$product->id}/variants", [
        'name' => 'Büyük', 'price_delta' => 30, 'is_default' => true,
    ])->assertCreated()->assertJsonPath('data.name', 'Büyük')->json('data.id');

    // Appears on the product.
    expect(app(TenantManager::class)->runAs($tenant, fn () => $product->fresh()->variants()->count()))->toBe(1);

    deleteJson("/v1/admin/products/{$product->id}/variants/{$id}")->assertOk();
    expect(app(TenantManager::class)->runAs($tenant, fn () => $product->fresh()->variants()->count()))->toBe(0);
});
