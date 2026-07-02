<?php

use App\Enums\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Auth\Totp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

it('enrols, confirms, verifies and disables TOTP two-factor', function () {
    $tenant = Tenant::factory()->create();
    $user = User::factory()->forTenant($tenant)->role(Role::Owner)->create();
    Sanctum::actingAs($user);

    // Enable → pending secret + provisioning URI; not yet active.
    $enable = postJson('/v1/auth/2fa/enable')->assertOk();
    $secret = $enable->json('data.secret');
    expect($secret)->not->toBeEmpty();
    expect($enable->json('data.otpauth_uri'))->toContain('otpauth://totp/');
    getJson('/v1/auth/me')->assertJsonPath('data.user.two_factor_enabled', false);

    // A wrong code cannot confirm.
    postJson('/v1/auth/2fa/confirm', ['code' => '000000'])->assertStatus(422);

    // The real code confirms and activates 2FA.
    postJson('/v1/auth/2fa/confirm', ['code' => Totp::codeAt($secret)])
        ->assertOk()
        ->assertJsonPath('data.two_factor_enabled', true);
    getJson('/v1/auth/me')->assertJsonPath('data.user.two_factor_enabled', true);

    // Step-up verification: valid passes, invalid is a 422.
    postJson('/v1/auth/2fa/verify', ['code' => Totp::codeAt($secret)])
        ->assertOk()
        ->assertJsonPath('data.verified', true);
    postJson('/v1/auth/2fa/verify', ['code' => '123456'])->assertStatus(422);

    // Cannot re-enrol while enabled.
    postJson('/v1/auth/2fa/enable')->assertStatus(422);

    // Disable requires a valid current code.
    postJson('/v1/auth/2fa/disable', ['code' => '000000'])->assertStatus(422);
    postJson('/v1/auth/2fa/disable', ['code' => Totp::codeAt($secret)])
        ->assertOk()
        ->assertJsonPath('data.two_factor_enabled', false);
    getJson('/v1/auth/me')->assertJsonPath('data.user.two_factor_enabled', false);
});

it('reports 2FA as not enabled when verifying without enrolment', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Owner)->create());

    postJson('/v1/auth/2fa/verify', ['code' => '123456'])
        ->assertStatus(422)
        ->assertJsonPath('errors.two_factor.0', 'Two-factor authentication is not enabled for this account.');
});
