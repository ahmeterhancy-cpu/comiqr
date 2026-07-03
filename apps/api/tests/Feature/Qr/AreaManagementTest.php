<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

it('creates typed dining areas and exposes the area on its tables', function () {
    $tenant = Tenant::factory()->create();
    app(TenantManager::class)->runAs($tenant, fn () => Branch::factory()->create());
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Owner)->create());

    $area = postJson('/v1/admin/dining-areas', ['name' => 'Odalar', 'type' => 'room'])
        ->assertCreated()
        ->json('data.id');

    postJson('/v1/admin/tables', ['code' => '101', 'dining_area_id' => $area])->assertCreated();

    getJson('/v1/admin/tables')
        ->assertOk()
        ->assertJsonPath('data.0.area.type', 'room')
        ->assertJsonPath('data.0.area.name', 'Odalar');

    getJson('/v1/admin/dining-areas')
        ->assertOk()
        ->assertJsonPath('data.0.type', 'room')
        ->assertJsonPath('data.0.tables_count', 1);
});

it('rejects an unknown dining area type', function () {
    $tenant = Tenant::factory()->create();
    app(TenantManager::class)->runAs($tenant, fn () => Branch::factory()->create());
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Owner)->create());

    postJson('/v1/admin/dining-areas', ['name' => 'X', 'type' => 'cabana'])->assertStatus(422);
});

it('exposes each tenant vertical in the superadmin list', function () {
    Tenant::factory()->create(['settings_json' => ['vertical' => 'hotel']]);
    Sanctum::actingAs(User::factory()->superadmin()->create(['email' => 'v-root@comiqr.com']));

    getJson('/v1/superadmin/tenants')
        ->assertOk()
        ->assertJsonPath('data.0.vertical', 'hotel');
});
