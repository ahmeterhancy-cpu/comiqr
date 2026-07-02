<?php

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function superadmin(): User
{
    return User::factory()->superadmin()->create(['email' => 'root@comiqr.com']);
}

it('lists all tenants across the platform', function () {
    $a = Tenant::factory()->create(['name' => 'Venue A']);
    User::factory()->forTenant($a)->role(Role::Owner)->create();
    Tenant::factory()->create(['name' => 'Venue B']);

    Sanctum::actingAs(superadmin());

    getJson('/v1/superadmin/tenants')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.users', 0); // newest first = Venue B, 0 users
});

it('suspends a tenant', function () {
    $tenant = Tenant::factory()->create(['status' => 'active']);
    Sanctum::actingAs(superadmin());

    patchJson("/v1/superadmin/tenants/{$tenant->id}", ['status' => 'suspended'])
        ->assertOk()
        ->assertJsonPath('data.status', 'suspended');

    expect($tenant->fresh()->status)->toBe('suspended');
});

it('impersonates a tenant owner and records an audit entry', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->forTenant($tenant)->role(Role::Owner)->create();

    Sanctum::actingAs(superadmin());

    $token = postJson("/v1/superadmin/tenants/{$tenant->id}/impersonate")
        ->assertOk()
        ->assertJsonPath('data.user.id', $owner->id)
        ->assertJsonPath('data.impersonated', true)
        ->json('data.token');

    // Impersonation token behaves as the owner.
    app('auth')->forgetGuards();
    getJson('/v1/auth/me', ['Authorization' => "Bearer {$token}"])
        ->assertOk()
        ->assertJsonPath('data.tenant.id', $tenant->id);

    expect(AuditLog::where('action', 'superadmin.impersonated')->where('subject_id', $owner->id)->exists())->toBeTrue();
});

it('forbids non-superadmins', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Owner)->create());

    getJson('/v1/superadmin/tenants')->assertForbidden();
});
