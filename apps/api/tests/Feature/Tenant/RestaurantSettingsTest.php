<?php

use App\Enums\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\post;

uses(RefreshDatabase::class);

it('lets the owner manage restaurant settings from their own panel', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    patchJson('/v1/tenant', [
        'name' => 'Girne Mangal',
        'settings_json' => [
            'sub_title' => 'Kebap & Mangal',
            'timing' => '09:00 - 23:00',
            'address' => 'Sahil Cad. 1',
            'allow_delivery' => false,
            'delivery_charge' => 30,
        ],
    ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Girne Mangal')
        ->assertJsonPath('data.settings.sub_title', 'Kebap & Mangal')
        ->assertJsonPath('data.settings.allow_delivery', false)
        ->assertJsonPath('data.settings.delivery_charge', 30);
});

it('superadmin manages a tenant restaurant on their behalf', function () {
    $tenant = Tenant::factory()->create(['name' => 'Eski Ad']);
    Sanctum::actingAs(User::factory()->superadmin()->create(['email' => 'rest-root@comiqr.com']));

    patchJson("/v1/superadmin/tenants/{$tenant->id}/restaurant", [
        'name' => 'Yönetilen Restoran',
        'settings_json' => ['timing' => '10:00 - 22:00', 'allow_takeaway' => false],
    ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Yönetilen Restoran')
        ->assertJsonPath('data.settings.timing', '10:00 - 22:00');

    expect($tenant->fresh()->name)->toBe('Yönetilen Restoran');
    expect($tenant->fresh()->settings_json['allow_takeaway'])->toBeFalse();
});

it('forbids a non-superadmin from the superadmin restaurant update', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Owner)->create());

    patchJson("/v1/superadmin/tenants/{$tenant->id}/restaurant", ['name' => 'x'])->assertForbidden();
});

it('uploads a restaurant logo into settings', function () {
    Storage::fake('public');
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = post('/v1/tenant/media', ['type' => 'logo', 'image' => UploadedFile::fake()->image('logo.png')])
        ->assertCreated();

    expect($res->json('data.type'))->toBe('logo');
    expect($res->json('data.url'))->toContain('/v1/media/restaurants/');
    expect($tenant->fresh()->settings_json['logo'])->toBe($res->json('data.url'));
});

it('validates the restaurant theme', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    patchJson('/v1/tenant', ['settings_json' => ['theme' => 'space']])->assertStatus(422);
    patchJson('/v1/tenant', ['settings_json' => ['theme' => 'modern']])
        ->assertOk()
        ->assertJsonPath('data.settings.theme', 'modern');
});

it('exposes venue branding + theme on the public menu', function () {
    $tenant = Tenant::factory()->create(['slug' => 'brand-venue']);
    app(TenantManager::class)->runAs($tenant, fn () => $tenant->update([
        'settings_json' => ['theme' => 'modern', 'logo' => 'https://x/logo.png', 'sub_title' => 'Kebap & Mangal'],
    ]));

    getJson('/v1/menu?tenant=brand-venue')
        ->assertOk()
        ->assertJsonPath('data.venue.theme', 'modern')
        ->assertJsonPath('data.venue.logo', 'https://x/logo.png')
        ->assertJsonPath('data.venue.sub_title', 'Kebap & Mangal');
});
