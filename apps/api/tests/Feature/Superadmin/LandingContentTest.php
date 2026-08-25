<?php

use App\Models\PlatformSetting;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

uses(RefreshDatabase::class);

function landingRoot(): User
{
    return User::factory()->superadmin()->create(['email' => 'landing-root@comiqr.com']);
}

it('serves an empty payload before anything is edited', function () {
    getJson('/v1/landing')
        ->assertOk()
        ->assertJsonPath('data.content', [])
        ->assertJsonPath('data.media', []);
});

it('stores only the overridden fields for a locale', function () {
    Sanctum::actingAs(landingRoot());

    putJson('/v1/superadmin/landing/tr', ['overrides' => [
        'hero.title1' => 'Yeni başlık',
        'faq.items.0.q' => 'Yeni soru',
    ]])->assertOk();

    expect(PlatformSetting::get('landing.content.tr'))->toBe([
        'hero.title1' => 'Yeni başlık',
        'faq.items.0.q' => 'Yeni soru',
    ]);

    // Anahtarların kendisi nokta içeriyor; JSON yolu ile adreslenemez.
    $content = getJson('/v1/landing')->assertOk()->json('data')['content'];
    expect($content['tr']['hero.title1'])->toBe('Yeni başlık');
});

it('drops a field when it is cleared, so the page falls back to the translation file', function () {
    Sanctum::actingAs(landingRoot());

    putJson('/v1/superadmin/landing/en', ['overrides' => ['hero.title1' => 'Kept', 'hero.title2' => 'Dropped']])
        ->assertOk();

    putJson('/v1/superadmin/landing/en', ['overrides' => ['hero.title1' => 'Kept', 'hero.title2' => '   ']])
        ->assertOk();

    expect(PlatformSetting::get('landing.content.en'))->toBe(['hero.title1' => 'Kept']);
});

it('keeps locales separate', function () {
    Sanctum::actingAs(landingRoot());

    putJson('/v1/superadmin/landing/tr', ['overrides' => ['hero.demo' => 'Menüyü aç']])->assertOk();
    putJson('/v1/superadmin/landing/el', ['overrides' => ['hero.demo' => 'Άνοιγμα μενού']])->assertOk();

    $content = getJson('/v1/landing')->assertOk()->json('data')['content'];
    expect($content['tr']['hero.demo'])->toBe('Menüyü aç');
    expect($content['el']['hero.demo'])->toBe('Άνοιγμα μενού');
});

it('uploads a landing image and exposes it on the public payload', function () {
    Storage::fake('public');
    Sanctum::actingAs(landingRoot());

    postJson('/v1/superadmin/landing-media', [
        'slot' => 'heroPhone',
        'image' => UploadedFile::fake()->image('phone.png', 375, 812),
    ])->assertCreated()->assertJsonPath('data.slot', 'heroPhone');

    $url = PlatformSetting::get('landing.media')['heroPhone'];
    expect($url)->toContain('/v1/media/landing/heroPhone-');

    getJson('/v1/landing')->assertJsonPath('data.media.heroPhone', $url);
});

it('removes an image so the page returns to its built-in artwork', function () {
    Storage::fake('public');
    Sanctum::actingAs(landingRoot());

    postJson('/v1/superadmin/landing-media', [
        'slot' => 'heroPhone',
        'image' => UploadedFile::fake()->image('phone.png'),
    ])->assertCreated();

    deleteJson('/v1/superadmin/landing-media/heroPhone')->assertOk();

    expect(PlatformSetting::get('landing.media'))->not->toHaveKey('heroPhone');
});

it('rejects an unknown image slot', function () {
    Storage::fake('public');
    Sanctum::actingAs(landingRoot());

    postJson('/v1/superadmin/landing-media', [
        'slot' => 'whatever',
        'image' => UploadedFile::fake()->image('x.png'),
    ])->assertStatus(422);
});

it('refuses edits from a tenant owner', function () {
    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->create());

    putJson('/v1/superadmin/landing/tr', ['overrides' => ['hero.title1' => 'Nope']])
        ->assertForbidden();

    expect(PlatformSetting::get('landing.content.tr'))->toBeNull();
});

it('refuses edits from a guest', function () {
    putJson('/v1/superadmin/landing/tr', ['overrides' => ['hero.title1' => 'Nope']])
        ->assertUnauthorized();
});
