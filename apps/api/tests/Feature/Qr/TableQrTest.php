<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function ownerFor(Tenant $tenant): User
{
    return User::factory()->forTenant($tenant)->role(Role::Owner)->create();
}

it('creates a table with an unguessable QR token and bulk-generates', function () {
    $tenant = Tenant::factory()->create();
    app(TenantManager::class)->runAs($tenant, fn () => Branch::factory()->create());
    Sanctum::actingAs(ownerFor($tenant));

    $token = postJson('/v1/admin/tables', ['code' => 'Masa 1'])
        ->assertCreated()
        ->assertJsonPath('data.code', 'Masa 1')
        ->json('data.qr_token');

    expect(strlen($token))->toBe(40);

    postJson('/v1/admin/tables/bulk', ['count' => 10, 'prefix' => 'Bahçe'])
        ->assertCreated()
        ->assertJsonCount(10, 'data');

    getJson('/v1/admin/tables')->assertOk()->assertJsonCount(11, 'data');
});

it('serves the public menu and opens a session from a QR token', function () {
    $tenant = Tenant::factory()->slug('qr-venue')->create();
    $table = app(TenantManager::class)->runAs($tenant, function () {
        Branch::factory()->create();
        $cat = Category::factory()->create(['name' => 'Ana Yemekler']);
        Product::factory()->forCategory($cat)->create(['name' => 'Kolokas', 'price' => 90]);

        return Table::factory()->create(['code' => 'Masa 7']);
    });

    getJson("/v1/menu/{$table->qr_token}")
        ->assertOk()
        ->assertJsonPath('data.table.code', 'Masa 7')
        ->assertJsonPath('data.venue.name', $tenant->name)
        ->assertJsonPath('data.categories.0.products.0.name', 'Kolokas');

    // Opening twice returns the same open session (join, not duplicate).
    $first = postJson("/v1/sessions/{$table->qr_token}/open", ['guest_count' => 2])
        ->assertCreated()->json('data.session_id');

    postJson("/v1/sessions/{$table->qr_token}/open")
        ->assertOk()
        ->assertJsonPath('data.session_id', $first);
});

it('rejects an unknown QR token', function () {
    getJson('/v1/menu/nope-nope-nope')->assertNotFound();
    postJson('/v1/sessions/nope-nope-nope/open')->assertNotFound();
});

it('requires manager role to manage tables', function () {
    $tenant = Tenant::factory()->create();
    app(TenantManager::class)->runAs($tenant, fn () => Branch::factory()->create());
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Kitchen)->create());

    postJson('/v1/admin/tables', ['code' => 'X'])->assertForbidden();
});
