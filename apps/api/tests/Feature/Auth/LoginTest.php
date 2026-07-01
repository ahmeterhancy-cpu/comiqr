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
