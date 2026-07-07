<?php

use App\Enums\Role;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function rootUser(): User
{
    return User::factory()->superadmin()->create(['email' => 'console-root@comiqr.com']);
}

it('reports platform overview with MRR from active + trialing plans', function () {
    $pro = Plan::factory()->create(['code' => 'pro-x', 'price_monthly' => 500, 'currency' => 'TRY', 'is_active' => true]);
    $free = Plan::factory()->create(['code' => 'free-x', 'price_monthly' => 0, 'currency' => 'TRY', 'is_active' => true]);

    Tenant::factory()->create(['status' => 'active', 'plan_id' => $pro->id]);    // +500
    Tenant::factory()->create(['status' => 'trialing', 'plan_id' => $free->id]);  // +0
    Tenant::factory()->create(['status' => 'suspended', 'plan_id' => $pro->id]);  // excluded

    Sanctum::actingAs(rootUser());

    getJson('/v1/superadmin/overview')
        ->assertOk()
        ->assertJsonPath('data.tenants.total', 3)
        ->assertJsonPath('data.tenants.active', 1)
        ->assertJsonPath('data.tenants.trialing', 1)
        ->assertJsonPath('data.tenants.suspended', 1)
        ->assertJsonPath('data.mrr', 500)
        ->assertJsonPath('data.orders', 0);
});

it('lists plans and edits pricing', function () {
    $plan = Plan::factory()->create(['code' => 'biz-x', 'name' => 'Business', 'price_monthly' => 900]);
    Sanctum::actingAs(rootUser());

    getJson('/v1/superadmin/plans')
        ->assertOk()
        ->assertJsonPath('data.0.code', 'biz-x')
        ->assertJsonPath('data.0.tenants', 0);

    patchJson("/v1/superadmin/plans/{$plan->id}", ['price_monthly' => 1200, 'is_active' => false])
        ->assertOk();

    expect((float) $plan->fresh()->price_monthly)->toBe(1200.0);
    expect($plan->fresh()->is_active)->toBeFalse();
});

it('returns tenant detail with users, subscription and counts', function () {
    $plan = Plan::factory()->create(['code' => 'pro-d', 'name' => 'Pro']);
    $tenant = Tenant::factory()->create(['plan_id' => $plan->id]);
    User::factory()->forTenant($tenant)->role(Role::Owner)->create();
    User::factory()->forTenant($tenant)->role(Role::Manager)->create();

    Sanctum::actingAs(rootUser());

    getJson("/v1/superadmin/tenants/{$tenant->id}")
        ->assertOk()
        ->assertJsonPath('data.plan', 'Pro')
        ->assertJsonPath('data.counts.users', 2)
        ->assertJsonCount(2, 'data.users');
});

it('searches users across tenants by email', function () {
    $a = Tenant::factory()->create();
    $b = Tenant::factory()->create();
    User::factory()->forTenant($a)->role(Role::Owner)->create(['email' => 'ahmet@venuea.com', 'name' => 'Ahmet']);
    User::factory()->forTenant($b)->role(Role::Owner)->create(['email' => 'mehmet@venueb.com', 'name' => 'Mehmet']);

    Sanctum::actingAs(rootUser());

    $emails = collect(getJson('/v1/superadmin/users?q=ahmet')->assertOk()->json('data.users'))->pluck('email');
    expect($emails)->toContain('ahmet@venuea.com')->not->toContain('mehmet@venueb.com');
});

it('overview includes recent lists and 7-day series', function () {
    Plan::factory()->create(['code' => 'p-s', 'price_monthly' => 0]);
    $tenant = Tenant::factory()->create(['name' => 'Yeni Mekan']);
    User::factory()->forTenant($tenant)->role(Role::Owner)->create(['name' => 'Sahip']);

    Sanctum::actingAs(rootUser());

    $data = getJson('/v1/superadmin/overview')->assertOk()->json('data');

    expect($data['recent_restaurants'][0]['name'])->toBe('Yeni Mekan');
    expect($data['users_total'])->toBeGreaterThanOrEqual(1);
    expect($data['restaurants_series'])->toHaveCount(7);
    expect($data['users_series'])->toHaveCount(7);
    // Today's bucket counts the tenant we just created.
    expect(collect($data['restaurants_series'])->last()['count'])->toBeGreaterThanOrEqual(1);
});

it('lists platform transactions', function () {
    $tenant = Tenant::factory()->create();
    app(TenantManager::class)->runAs($tenant, function () {
        $branch = \App\Models\Branch::factory()->create();
        $order = \App\Models\Order::factory()->create(['branch_id' => $branch->id]);
        \App\Models\Payment::create([
            'order_id' => $order->id, 'gateway' => 'cash', 'amount' => 250, 'status' => 'paid',
        ]);
    });

    Sanctum::actingAs(rootUser());

    getJson('/v1/superadmin/transactions')
        ->assertOk()
        ->assertJsonPath('data.0.gateway', 'cash')
        ->assertJsonPath('data.0.status', 'paid');
});

it('manages global allergens', function () {
    Sanctum::actingAs(rootUser());

    $id = postJson('/v1/superadmin/allergens', ['code' => 'sesame', 'name' => 'Susam', 'icon' => '🌰'])
        ->assertCreated()
        ->assertJsonPath('data.code', 'sesame')
        ->json('data.id');

    getJson('/v1/superadmin/allergens')->assertOk()
        ->assertJsonFragment(['code' => 'sesame']);

    // A duplicate code is a clean 422, not a 500 unique-violation.
    postJson('/v1/superadmin/allergens', ['code' => 'sesame', 'name' => 'Tekrar'])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('code');

    deleteJson("/v1/superadmin/allergens/{$id}")->assertOk();
});

it('tenant list carries the owner name and supports soft delete', function () {
    $tenant = Tenant::factory()->create(['name' => 'Silinecek Mekan']);
    User::factory()->forTenant($tenant)->role(Role::Owner)->create(['name' => 'Ali Veli']);

    Sanctum::actingAs(rootUser());

    getJson('/v1/superadmin/tenants')->assertOk()->assertJsonPath('data.0.owner_name', 'Ali Veli');

    deleteJson("/v1/superadmin/tenants/{$tenant->id}")->assertOk();

    getJson('/v1/superadmin/tenants')->assertOk()->assertJsonMissing(['name' => 'Silinecek Mekan']);
    expect(Tenant::withTrashed()->whereKey($tenant->id)->first()->trashed())->toBeTrue();
});

it('forbids non-superadmins from the console', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Owner)->create());

    getJson('/v1/superadmin/overview')->assertForbidden();
});
