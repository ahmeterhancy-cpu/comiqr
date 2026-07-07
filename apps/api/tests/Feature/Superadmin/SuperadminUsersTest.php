<?php

use App\Enums\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function usersRoot(): User
{
    return User::factory()->superadmin()->create(['email' => 'users-root@comiqr.com']);
}

it('lists all users paginated when no query is given', function () {
    $t = Tenant::factory()->create();
    User::factory()->forTenant($t)->role(Role::Owner)->count(3)->create();

    Sanctum::actingAs(usersRoot());

    getJson('/v1/superadmin/users')
        ->assertOk()
        ->assertJsonStructure(['data' => ['users', 'total', 'page', 'per_page', 'last_page']])
        // 3 owners + the acting superadmin = 4
        ->assertJsonPath('data.total', 4);
});

it('creates a tenant user who can then log in', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(usersRoot());

    postJson('/v1/superadmin/users', [
        'name' => 'Yeni Garson',
        'email' => 'garson@venue.com',
        'password' => 'secret123',
        'role' => 'waiter',
        'tenant_id' => $tenant->id,
    ])
        ->assertCreated()
        ->assertJsonPath('data.email', 'garson@venue.com')
        ->assertJsonPath('data.role', 'waiter')
        ->assertJsonPath('data.tenant', $tenant->name);

    $user = User::withoutTenancy()->where('email', 'garson@venue.com')->first();
    expect($user->tenant_id)->toBe($tenant->id);
    expect($user->role)->toBe(Role::Waiter);

    // The 'hashed' cast must have hashed the password → the new user can log in.
    postJson('/v1/auth/login', ['email' => 'garson@venue.com', 'password' => 'secret123'])
        ->assertOk()
        ->assertJsonPath('data.user.email', 'garson@venue.com');
});

it('creates a platform superadmin with no tenant', function () {
    Sanctum::actingAs(usersRoot());

    postJson('/v1/superadmin/users', [
        'name' => 'İkinci Admin',
        'email' => 'admin2@comiqr.com',
        'password' => 'secret123',
        'role' => 'superadmin',
    ])
        ->assertCreated()
        ->assertJsonPath('data.role', 'superadmin')
        ->assertJsonPath('data.tenant', null);

    expect(User::withoutTenancy()->where('email', 'admin2@comiqr.com')->first()->tenant_id)->toBeNull();
});

it('rejects a tenant role without a tenant', function () {
    Sanctum::actingAs(usersRoot());

    postJson('/v1/superadmin/users', [
        'name' => 'Sahipsiz',
        'email' => 'sahipsiz@venue.com',
        'password' => 'secret123',
        'role' => 'owner',
    ])->assertStatus(422)->assertJsonValidationErrors('tenant_id');
});

it('rejects a superadmin bound to a tenant', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(usersRoot());

    postJson('/v1/superadmin/users', [
        'name' => 'Karışık',
        'email' => 'karisik@comiqr.com',
        'password' => 'secret123',
        'role' => 'superadmin',
        'tenant_id' => $tenant->id,
    ])->assertStatus(422)->assertJsonValidationErrors('tenant_id');
});

it('rejects a duplicate email', function () {
    $tenant = Tenant::factory()->create();
    User::factory()->forTenant($tenant)->role(Role::Owner)->create(['email' => 'dupe@venue.com']);
    Sanctum::actingAs(usersRoot());

    postJson('/v1/superadmin/users', [
        'name' => 'Kopya',
        'email' => 'dupe@venue.com',
        'password' => 'secret123',
        'role' => 'manager',
        'tenant_id' => $tenant->id,
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('forbids non-superadmin callers from creating users', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->forTenant($tenant)->role(Role::Owner)->create();
    Sanctum::actingAs($owner);

    postJson('/v1/superadmin/users', [
        'name' => 'X', 'email' => 'x@x.com', 'password' => 'secret123', 'role' => 'waiter', 'tenant_id' => $tenant->id,
    ])->assertForbidden();

    getJson('/v1/superadmin/users')->assertForbidden();
});
