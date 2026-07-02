<?php

use App\Enums\Role;
use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

it('uploads a product image and exposes its url', function () {
    Storage::fake('public');

    $tenant = Tenant::factory()->create();
    $product = app(TenantManager::class)->runAs($tenant, fn () => Product::factory()
        ->forCategory(Category::factory()->create())->create());
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = postJson("/v1/admin/products/{$product->id}/media", [
        'image' => UploadedFile::fake()->image('hellim.jpg', 400, 300),
    ])->assertCreated();

    $images = $res->json('data.images');
    expect($images)->toHaveCount(1)
        ->and($images[0])->toContain('/v1/media/products/');

    // The stored file exists on the public disk.
    expect(Storage::disk('public')->allFiles('products'))->not->toBeEmpty();
});

it('rejects non-image uploads', function () {
    Storage::fake('public');
    $tenant = Tenant::factory()->create();
    $product = app(TenantManager::class)->runAs($tenant, fn () => Product::factory()
        ->forCategory(Category::factory()->create())->create());
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson("/v1/admin/products/{$product->id}/media", [
        'image' => UploadedFile::fake()->create('doc.pdf', 100),
    ])->assertStatus(422);
});
