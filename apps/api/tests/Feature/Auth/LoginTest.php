<?php

use App\Enums\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function makeOwner(array $overrides = []): User
{
    $tenant = Tenant::factory()->create($overrides['tenant'] ?? []);

    return User::factory()->forTenant($tenant)->role(Role::Owner)->create([
        'email' => $overrides['email'] ?? 'owner@example.com',
        'password' => Hash::make($overrides['password'] ?? 'secret123'),
    ]);
}

it('logs in with valid credentials and returns a token', function () {
    makeOwner();

    postJson('/v1/auth/login', ['email' => 'owner@example.com', 'password' => 'secret123'])
        ->assertOk()
        ->assertJsonPath('data.user.email', 'owner@example.com')
        ->assertJsonStructure(['data' => ['user', 'tenant' => ['id', 'slug'], 'token']]);
});

it('rejects an invalid password', function () {
    makeOwner();

    postJson('/v1/auth/login', ['email' => 'owner@example.com', 'password' => 'wrong'])
        ->assertStatus(422)->assertJsonValidationErrors('email');
});

it('blocks login for a suspended tenant', function () {
    makeOwner(['tenant' => ['status' => 'suspended']]);

    postJson('/v1/auth/login', ['email' => 'owner@example.com', 'password' => 'secret123'])
        ->assertStatus(422)->assertJsonValidationErrors('email');
});

it('requires authentication for /auth/me', function () {
    getJson('/v1/auth/me')->assertUnauthorized();
});

it('returns the current superadmin on /auth/me without a tenant', function () {
    // Regression: /auth/me must live outside the fail-closed tenant.user group so
    // superadmins (tenant_id null) can validate their session — otherwise the admin
    // panel bounces them back to /login on a 403.
    $root = User::factory()->superadmin()->create(['email' => 'root@comiqr.com']);
    $token = $root->createToken('t')->plainTextToken;

    getJson('/v1/auth/me', ['Authorization' => "Bearer {$token}"])
        ->assertOk()
        ->assertJsonPath('data.user.email', 'root@comiqr.com')
        ->assertJsonPath('data.user.role', 'superadmin')
        ->assertJsonPath('data.tenant', null);
});

it('returns the current owner with their tenant on /auth/me', function () {
    $owner = makeOwner(['email' => 'me@example.com']);
    $token = $owner->createToken('t')->plainTextToken;

    getJson('/v1/auth/me', ['Authorization' => "Bearer {$token}"])
        ->assertOk()
        ->assertJsonPath('data.user.email', 'me@example.com')
        ->assertJsonPath('data.tenant.id', $owner->tenant_id);
});

it('scopes each owner to only their own tenant', function () {
    $ownerA = makeOwner(['email' => 'a@example.com']);
    $ownerB = makeOwner(['email' => 'b@example.com']);

    $tokenA = $ownerA->createToken('t')->plainTextToken;
    $tokenB = $ownerB->createToken('t')->plainTextToken;

    getJson('/v1/tenant', ['Authorization' => "Bearer {$tokenA}"])
        ->assertOk()->assertJsonPath('data.id', $ownerA->tenant_id);

    // The auth guard caches the resolved user across sub-requests within a single
    // test (a harness artifact — in production each request is its own process).
    // Forget guards so the second Bearer token re-resolves as owner B.
    app('auth')->forgetGuards();

    getJson('/v1/tenant', ['Authorization' => "Bearer {$tokenB}"])
        ->assertOk()->assertJsonPath('data.id', $ownerB->tenant_id);
});
