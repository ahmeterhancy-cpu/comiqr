<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function branchTenant(): array
{
    $tenant = Tenant::factory()->create();
    $branch = app(TenantManager::class)->runAs($tenant, fn () => Branch::factory()->create(['name' => 'Merkez']));

    return [$tenant, $branch];
}

it('manages multiple branches', function () {
    [$tenant, $first] = branchTenant();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/branches', ['name' => 'Girne Şubesi', 'address' => 'Sahil Yolu'])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Girne Şubesi');

    getJson('/v1/admin/branches')->assertOk()->assertJsonCount(2, 'data');
});

it('keeps at least one branch', function () {
    [$tenant, $only] = branchTenant();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    deleteJson("/v1/admin/branches/{$only->id}")->assertStatus(422);
});

it('scopes analytics to a branch', function () {
    [$tenant, $first] = branchTenant();
    $second = app(TenantManager::class)->runAs($tenant, fn () => Branch::factory()->create());
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    // The second branch has no orders → 0 for that branch (null-plan tenant is
    // unrestricted, so the analytics plan-gate passes).
    getJson("/v1/admin/analytics/overview?branch_id={$second->id}")
        ->assertOk()
        ->assertJsonPath('data.orders', 0);
});
