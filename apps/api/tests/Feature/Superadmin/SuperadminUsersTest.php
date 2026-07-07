<?php

use App\Enums\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
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

it('blocks a user: login is denied and active tokens are revoked', function () {
    $tenant = Tenant::factory()->create();
    $user = User::factory()->forTenant($tenant)->role(Role::Waiter)->create([
        'email' => 'block@venue.com', 'password' => Hash::make('secret123'),
    ]);
    $user->createToken('active-session');
    Sanctum::actingAs(usersRoot());

    patchJson("/v1/superadmin/users/{$user->id}", ['is_active' => false])
        ->assertOk()->assertJsonPath('data.is_active', false);

    expect($user->fresh()->is_active)->toBeFalse();
    expect($user->tokens()->count())->toBe(0);

    postJson('/v1/auth/login', ['email' => 'block@venue.com', 'password' => 'secret123'])
        ->assertStatus(422)->assertJsonValidationErrors('email');
});

it('unblocks a user so they can log in again', function () {
    $tenant = Tenant::factory()->create();
    User::factory()->forTenant($tenant)->role(Role::Owner)->create([
        'email' => 'unblock@venue.com', 'password' => Hash::make('secret123'), 'is_active' => false,
    ]);
    Sanctum::actingAs(usersRoot());

    postJson('/v1/auth/login', ['email' => 'unblock@venue.com', 'password' => 'secret123'])->assertStatus(422);

    $blocked = User::withoutTenancy()->where('email', 'unblock@venue.com')->first();
    patchJson("/v1/superadmin/users/{$blocked->id}", ['is_active' => true])->assertOk();

    postJson('/v1/auth/login', ['email' => 'unblock@venue.com', 'password' => 'secret123'])->assertOk();
});

it('resets a password and revokes the old sessions', function () {
    $tenant = Tenant::factory()->create();
    $user = User::factory()->forTenant($tenant)->role(Role::Manager)->create([
        'email' => 'pw@venue.com', 'password' => Hash::make('oldpass123'),
    ]);
    $user->createToken('old-session');
    Sanctum::actingAs(usersRoot());

    patchJson("/v1/superadmin/users/{$user->id}", ['password' => 'newpass123'])->assertOk();

    expect($user->tokens()->count())->toBe(0);
    postJson('/v1/auth/login', ['email' => 'pw@venue.com', 'password' => 'newpass123'])->assertOk();
    postJson('/v1/auth/login', ['email' => 'pw@venue.com', 'password' => 'oldpass123'])->assertStatus(422);
});

it('soft-deletes a user and revokes their tokens', function () {
    $tenant = Tenant::factory()->create();
    $user = User::factory()->forTenant($tenant)->role(Role::Kitchen)->create(['email' => 'del@venue.com']);
    $user->createToken('s');
    Sanctum::actingAs(usersRoot());

    deleteJson("/v1/superadmin/users/{$user->id}")->assertOk()->assertJsonPath('data.deleted', true);

    expect(User::withoutTenancy()->find($user->id))->toBeNull();
    expect($user->tokens()->count())->toBe(0);
});

it('refuses to block or delete your own account', function () {
    $root = usersRoot();
    Sanctum::actingAs($root);

    patchJson("/v1/superadmin/users/{$root->id}", ['is_active' => false])
        ->assertStatus(422)->assertJsonValidationErrors('is_active');
    deleteJson("/v1/superadmin/users/{$root->id}")
        ->assertStatus(422)->assertJsonValidationErrors('user');

    expect($root->fresh()->is_active)->toBeTrue();
});

it('forbids non-superadmin callers from blocking or deleting users', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->forTenant($tenant)->role(Role::Owner)->create();
    $victim = User::factory()->forTenant($tenant)->role(Role::Waiter)->create();
    Sanctum::actingAs($owner);

    patchJson("/v1/superadmin/users/{$victim->id}", ['is_active' => false])->assertForbidden();
    deleteJson("/v1/superadmin/users/{$victim->id}")->assertForbidden();
});
