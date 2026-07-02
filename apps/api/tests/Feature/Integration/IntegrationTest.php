<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Integration;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function seedOrderableForIntegration(): array
{
    $tenant = Tenant::factory()->create();

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $product = Product::factory()->forCategory(Category::factory()->create())->create(['price' => 100]);
        $table = Table::factory()->create();

        return compact('tenant', 'product', 'table');
    });
}

it('lets a manager create, list (secret hidden) and delete an integration', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $id = postJson('/v1/admin/integrations', [
        'type' => 'pos', 'provider' => 'webhook', 'name' => 'Simpra',
        'config_json' => ['endpoint' => 'https://pos.example.com/hook', 'secret' => 's3cret'],
    ])
        ->assertCreated()
        ->assertJsonPath('data.endpoint', 'https://pos.example.com/hook')
        ->assertJsonPath('data.has_secret', true)
        ->json('data.id');

    // The secret is never returned to the panel.
    getJson('/v1/admin/integrations')
        ->assertOk()
        ->assertJsonPath('data.0.has_secret', true)
        ->assertJsonMissing(['secret' => 's3cret']);

    deleteJson("/v1/admin/integrations/{$id}")->assertOk();
});

it('pushes a placed order to an active integration endpoint', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = seedOrderableForIntegration();

    app(TenantManager::class)->runAs($tenant, fn () => Integration::create([
        'type' => 'pos', 'provider' => 'webhook', 'name' => 'POS',
        'config_json' => ['endpoint' => 'https://pos.example.com/orders'], 'is_active' => true,
    ]));

    postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 2]],
    ])->assertCreated();

    Http::assertSent(fn ($req) => $req->url() === 'https://pos.example.com/orders'
        && $req['event'] === 'order.placed'
        && isset($req['data']['order_id']));
});

it('does not push when the integration is inactive', function () {
    Http::fake();
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = seedOrderableForIntegration();

    app(TenantManager::class)->runAs($tenant, fn () => Integration::create([
        'type' => 'pos', 'provider' => 'webhook', 'name' => 'POS',
        'config_json' => ['endpoint' => 'https://pos.example.com/orders'], 'is_active' => false,
    ]));

    postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertCreated();

    Http::assertNothingSent();
});

it('pings an integration from the test endpoint', function () {
    Http::fake(['*' => Http::response([], 200)]);
    $tenant = Tenant::factory()->create();

    $integration = app(TenantManager::class)->runAs($tenant, fn () => Integration::create([
        'type' => 'delivery', 'provider' => 'webhook', 'name' => 'Yemeksepeti',
        'config_json' => ['endpoint' => 'https://ys.example.com/hook'], 'is_active' => true,
    ]));

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson("/v1/admin/integrations/{$integration->id}/test")
        ->assertOk()
        ->assertJsonPath('data.ok', true);

    Http::assertSent(fn ($req) => $req['event'] === 'ping');
});
