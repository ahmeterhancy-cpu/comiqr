<?php

use App\Models\Branch;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Core invariant (docs/04 §4.2): every query on a tenant-owned model is
 * auto-filtered by the active tenant, and no tenant row can be written unscoped.
 */

beforeEach(function () {
    $this->tenants = app(TenantManager::class);
    $this->tenants->forget();
});

it('only reads rows belonging to the active tenant', function () {
    $a = Tenant::factory()->create();
    $b = Tenant::factory()->create();

    $this->tenants->runAs($a, fn () => Branch::factory()->count(2)->create());
    $this->tenants->runAs($b, fn () => Branch::factory()->count(3)->create());

    $this->tenants->set($a);
    expect(Branch::count())->toBe(2);

    $this->tenants->set($b);
    expect(Branch::count())->toBe(3);
});

it('never leaks another tenant row through find()', function () {
    $a = Tenant::factory()->create();
    $b = Tenant::factory()->create();

    $branchA = $this->tenants->runAs($a, fn () => Branch::factory()->create());

    $this->tenants->set($b);

    expect(Branch::find($branchA->id))->toBeNull();
});

it('auto-fills tenant_id from the active tenant on create', function () {
    $a = Tenant::factory()->create();

    $branch = $this->tenants->runAs($a, fn () => Branch::factory()->create());

    expect($branch->tenant_id)->toBe($a->id);
});

it('refuses to create a tenant-owned row with no active tenant', function () {
    Tenant::factory()->create();
    $this->tenants->forget();

    expect(fn () => Branch::factory()->create())
        ->toThrow(RuntimeException::class);
});

it('can bypass the scope explicitly with withoutTenancy()', function () {
    $a = Tenant::factory()->create();
    $b = Tenant::factory()->create();

    $this->tenants->runAs($a, fn () => Branch::factory()->count(2)->create());
    $this->tenants->runAs($b, fn () => Branch::factory()->count(3)->create());

    $this->tenants->set($a);

    expect(Branch::withoutTenancy()->count())->toBe(5)
        ->and(Branch::forTenant($b)->count())->toBe(3);
});

it('does not filter when no tenant is active', function () {
    $a = Tenant::factory()->create();
    $this->tenants->runAs($a, fn () => Branch::factory()->count(2)->create());

    $this->tenants->forget();

    // Central context: scope is a no-op (guarded operations must scope explicitly).
    expect(Branch::count())->toBe(2);
});
