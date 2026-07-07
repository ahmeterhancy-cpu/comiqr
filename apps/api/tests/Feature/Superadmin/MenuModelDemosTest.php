<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\DiningArea;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;

uses(RefreshDatabase::class);

/**
 * Seed a tenant with one active table per [areaType => code] entry.
 * Returns the generated qr_tokens keyed by area type.
 */
function seedModelVenue(?string $vertical, array $areas, array $attrs = []): array
{
    $settings = $vertical === null ? [] : ['vertical' => $vertical];
    $tenant = Tenant::factory()->create(array_merge(['settings_json' => $settings], $attrs));

    return app(TenantManager::class)->runAs($tenant, function () use ($areas) {
        $branch = Branch::factory()->create();
        $tokens = [];
        foreach ($areas as $type => $code) {
            $area = DiningArea::factory()->create(['branch_id' => $branch->id, 'name' => ucfirst($type), 'type' => $type]);
            $table = Table::factory()->create(['branch_id' => $branch->id, 'dining_area_id' => $area->id, 'code' => $code]);
            $tokens[$type] = $table->qr_token;
        }

        return $tokens;
    });
}

function superRoot(): User
{
    return User::factory()->superadmin()->create();
}

it('resolves a live demo deep-link per vertical', function () {
    $r = seedModelVenue(null, ['table' => 'M1']);                       // restaurant (vertical unset → default)
    $h = seedModelVenue('hotel', ['room' => '201', 'sunbed' => 'S1']);  // hotel + beach (sunbed area)
    $b = seedModelVenue('bar', ['table' => 'B1']);                      // bar

    Sanctum::actingAs(superRoot());

    $models = collect(getJson('/v1/superadmin/menu-model-demos')->assertOk()->json('data.models'))
        ->keyBy('vertical');

    expect($models['restaurant']['demo']['qr_token'])->toBe($r['table']);
    expect($models['restaurant']['demo']['area_type'])->toBe('table');

    expect($models['hotel']['demo']['qr_token'])->toBe($h['room']);
    expect($models['hotel']['demo']['area_type'])->toBe('room');

    expect($models['bar']['demo']['qr_token'])->toBe($b['table']);
    expect($models['bar']['demo']['area_type'])->toBe('table');

    // Beach has no dedicated tenant → resolves to the sunbed area seeded in the hotel demo.
    expect($models['beach']['demo']['qr_token'])->toBe($h['sunbed']);
    expect($models['beach']['demo']['area_type'])->toBe('sunbed');
});

it("does not pick a bar's table for the restaurant model", function () {
    // Only a bar exists — it has a 'table' area but vertical=bar, so restaurant stays null.
    seedModelVenue('bar', ['table' => 'B1']);
    Sanctum::actingAs(superRoot());

    $models = collect(getJson('/v1/superadmin/menu-model-demos')->json('data.models'))->keyBy('vertical');

    expect($models['restaurant']['demo'])->toBeNull();
    expect($models['bar']['demo']['qr_token'])->not->toBeNull();
});

it('excludes suspended tenants', function () {
    seedModelVenue(null, ['table' => 'SUSP'], ['status' => 'suspended']);
    Sanctum::actingAs(superRoot());

    $models = collect(getJson('/v1/superadmin/menu-model-demos')->json('data.models'))->keyBy('vertical');

    expect($models['restaurant']['demo'])->toBeNull();
});

it('rejects non-superadmin callers', function () {
    $tenant = Tenant::factory()->create();
    $owner = User::factory()->forTenant($tenant)->role(Role::Owner)->create();
    Sanctum::actingAs($owner);

    getJson('/v1/superadmin/menu-model-demos')->assertForbidden();
});
