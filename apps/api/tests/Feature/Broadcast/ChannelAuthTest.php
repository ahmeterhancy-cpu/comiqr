<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Broadcast\ChannelAuth;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('lets staff join their own tenant branch feeds', function () {
    $tenant = Tenant::factory()->create();
    $branch = app(TenantManager::class)->runAs($tenant, fn () => Branch::factory()->create());
    $user = User::factory()->forTenant($tenant)->role(Role::Kitchen)->create();

    expect(ChannelAuth::canJoinBranch($user, $branch->id, 'kds'))->toBeTrue();
    expect(ChannelAuth::canJoinBranch($user, $branch->id, 'orders'))->toBeTrue();
    expect(ChannelAuth::canJoinBranch($user, $branch->id, 'waiter'))->toBeTrue();
});

it('blocks a staff member from another tenant\'s branch', function () {
    $tenantA = Tenant::factory()->create();
    $branchA = app(TenantManager::class)->runAs($tenantA, fn () => Branch::factory()->create());

    $tenantB = Tenant::factory()->create();
    $userB = User::factory()->forTenant($tenantB)->role(Role::Kitchen)->create();

    expect(ChannelAuth::canJoinBranch($userB, $branchA->id, 'kds'))->toBeFalse();
});

it('rejects an unknown feed', function () {
    $tenant = Tenant::factory()->create();
    $branch = app(TenantManager::class)->runAs($tenant, fn () => Branch::factory()->create());
    $user = User::factory()->forTenant($tenant)->role(Role::Kitchen)->create();

    expect(ChannelAuth::canJoinBranch($user, $branch->id, 'secrets'))->toBeFalse();
});

it('rejects a non-existent branch', function () {
    $tenant = Tenant::factory()->create();
    $user = User::factory()->forTenant($tenant)->role(Role::Kitchen)->create();

    expect(ChannelAuth::canJoinBranch($user, 999999, 'kds'))->toBeFalse();
});
