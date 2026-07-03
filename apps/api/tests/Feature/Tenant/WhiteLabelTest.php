<?php

use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\getJson;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

it('applies white-label branding on a plan that unlocks it', function () {
    Tenant::factory()->slug('wl-venue')->create([
        'plan_id' => Plan::firstWhere('code', 'enterprise')->id,
        'settings_json' => ['brand_color' => '#123456', 'hide_powered_by' => true],
    ]);

    getJson('/v1/menu?tenant=wl-venue')
        ->assertOk()
        ->assertJsonPath('data.venue.brand_color', '#123456')
        ->assertJsonPath('data.venue.powered_by', false);
});

it('ignores white-label branding on a plan without the feature', function () {
    Tenant::factory()->slug('nowl-venue')->create([
        'plan_id' => Plan::firstWhere('code', 'free')->id,
        'settings_json' => ['brand_color' => '#123456', 'hide_powered_by' => true],
    ]);

    getJson('/v1/menu?tenant=nowl-venue')
        ->assertOk()
        ->assertJsonPath('data.venue.brand_color', null)
        ->assertJsonPath('data.venue.powered_by', true);
});
