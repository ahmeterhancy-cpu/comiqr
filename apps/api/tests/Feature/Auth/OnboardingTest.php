<?php

use App\Models\Branch;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(Database\Seeders\PlanSeeder::class);
});

it('registers a tenant with an owner, branch, subscription and token', function () {
    $response = postJson('/v1/auth/register-tenant', [
        'business_name' => 'Kyrenia Coffee House',
        'owner_name' => 'Ada Yilmaz',
        'email' => 'ada@example.com',
        'password' => 'Str0ng-Passw0rd!',
        'password_confirmation' => 'Str0ng-Passw0rd!',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.user.email', 'ada@example.com')
        ->assertJsonPath('data.user.role', 'owner')
        ->assertJsonStructure(['data' => ['tenant' => ['id', 'slug'], 'user', 'token', 'panel_url']]);

    $tenant = Tenant::firstWhere('slug', $response->json('data.tenant.slug'));

    expect($tenant)->not->toBeNull()
        ->and($tenant->status)->toBe('trialing')
        ->and(User::withoutTenancy()->where('tenant_id', $tenant->id)->count())->toBe(1)
        ->and(Branch::forTenant($tenant)->count())->toBe(1)
        ->and(Subscription::forTenant($tenant)->count())->toBe(1);
});

it('derives a slug from the business name', function () {
    postJson('/v1/auth/register-tenant', [
        'business_name' => 'Deniz Restaurant',
        'owner_name' => 'Mert',
        'email' => 'mert@example.com',
        'password' => 'Str0ng-Passw0rd!',
        'password_confirmation' => 'Str0ng-Passw0rd!',
    ])->assertCreated()
        ->assertJsonPath('data.tenant.slug', 'deniz-restaurant');
});

it('rejects a reserved slug', function () {
    postJson('/v1/auth/register-tenant', [
        'business_name' => 'Admin Cafe',
        'owner_name' => 'X',
        'email' => 'x@example.com',
        'password' => 'Str0ng-Passw0rd!',
        'password_confirmation' => 'Str0ng-Passw0rd!',
        'slug' => 'admin',
    ])->assertStatus(422)->assertJsonValidationErrors('slug');
});

it('rejects a duplicate email', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    postJson('/v1/auth/register-tenant', [
        'business_name' => 'Another Cafe',
        'owner_name' => 'Y',
        'email' => 'taken@example.com',
        'password' => 'Str0ng-Passw0rd!',
        'password_confirmation' => 'Str0ng-Passw0rd!',
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('lets the freshly onboarded owner read their own account', function () {
    $token = postJson('/v1/auth/register-tenant', [
        'business_name' => 'Sunset Bar',
        'owner_name' => 'Lina',
        'email' => 'lina@example.com',
        'password' => 'Str0ng-Passw0rd!',
        'password_confirmation' => 'Str0ng-Passw0rd!',
    ])->json('data.token');

    getJson('/v1/auth/me', ['Authorization' => "Bearer {$token}"])
        ->assertOk()
        ->assertJsonPath('data.user.email', 'lina@example.com')
        ->assertJsonPath('data.tenant.slug', 'sunset-bar');
});
