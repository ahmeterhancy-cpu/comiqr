<?php

use App\Enums\Role;
use App\Models\Customer;
use App\Models\LoyaltyAccount;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/**
 * Three customers: all reachable by phone; two also by e-mail; loyalty points
 * 200 / 50 / 0. Lets each audience + channel combination be asserted.
 */
function seedCampaignAudience(): Tenant
{
    $tenant = Tenant::factory()->create();

    app(TenantManager::class)->runAs($tenant, function () {
        $c1 = Customer::factory()->create(['email' => null]);
        $c2 = Customer::factory()->create(['email' => 'c2@example.com']);
        $c3 = Customer::factory()->create(['email' => 'c3@example.com']);
        LoyaltyAccount::create(['customer_id' => $c1->id, 'points_balance' => 200]);
        LoyaltyAccount::create(['customer_id' => $c2->id, 'points_balance' => 50]);
        LoyaltyAccount::create(['customer_id' => $c3->id, 'points_balance' => 0]);
    });

    return $tenant;
}

function actingManager(Tenant $tenant): void
{
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());
}

it('creates a draft campaign', function () {
    $tenant = Tenant::factory()->create();
    actingManager($tenant);

    postJson('/v1/admin/campaigns', [
        'name' => 'Bayram Kampanyası', 'channel' => 'sms', 'body' => 'Bayramınız kutlu olsun!', 'audience' => 'all',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.sent_count', 0);
});

it('sends over SMS to every phone-reachable customer', function () {
    $tenant = seedCampaignAudience();
    actingManager($tenant);

    $id = postJson('/v1/admin/campaigns', [
        'name' => 'A', 'channel' => 'sms', 'body' => 'x', 'audience' => 'all',
    ])->json('data.id');

    postJson("/v1/admin/campaigns/{$id}/send")
        ->assertOk()
        ->assertJsonPath('data.status', 'sent')
        ->assertJsonPath('data.recipient_count', 3)
        ->assertJsonPath('data.sent_count', 3);
});

it('e-mail only reaches customers with an address', function () {
    $tenant = seedCampaignAudience();
    actingManager($tenant);

    $id = postJson('/v1/admin/campaigns', [
        'name' => 'B', 'channel' => 'email', 'subject' => 'Selam', 'body' => 'x', 'audience' => 'all',
    ])->json('data.id');

    postJson("/v1/admin/campaigns/{$id}/send")
        ->assertOk()
        ->assertJsonPath('data.sent_count', 2);
});

it('delivers email campaigns through the real Brevo gateway when configured', function () {
    config(['services.brevo.key' => 'test-key']);
    Http::fake(['api.brevo.com/*' => Http::response(['messageId' => 'x'], 201)]);

    $tenant = seedCampaignAudience();
    actingManager($tenant);

    $id = postJson('/v1/admin/campaigns', [
        'name' => 'Brevo', 'channel' => 'email', 'subject' => 'Merhaba', 'body' => 'Kampanya', 'audience' => 'all',
    ])->json('data.id');

    postJson("/v1/admin/campaigns/{$id}/send")->assertOk()->assertJsonPath('data.sent_count', 2);

    Http::assertSent(fn ($req) => str_contains($req->url(), 'api.brevo.com/v3/smtp/email'));
});

it('min_points audience filters by loyalty balance', function () {
    $tenant = seedCampaignAudience();
    actingManager($tenant);

    $id = postJson('/v1/admin/campaigns', [
        'name' => 'VIP', 'channel' => 'sms', 'body' => 'x', 'audience' => 'min_points', 'min_points' => 100,
    ])->json('data.id');

    postJson("/v1/admin/campaigns/{$id}/send")
        ->assertOk()
        ->assertJsonPath('data.sent_count', 1);
});

it('cannot be sent twice', function () {
    $tenant = seedCampaignAudience();
    actingManager($tenant);

    $id = postJson('/v1/admin/campaigns', [
        'name' => 'C', 'channel' => 'sms', 'body' => 'x', 'audience' => 'all',
    ])->json('data.id');

    postJson("/v1/admin/campaigns/{$id}/send")->assertOk();
    postJson("/v1/admin/campaigns/{$id}/send")->assertStatus(422);
});

it('requires min_points when the audience is min_points', function () {
    $tenant = Tenant::factory()->create();
    actingManager($tenant);

    postJson('/v1/admin/campaigns', [
        'name' => 'D', 'channel' => 'sms', 'body' => 'x', 'audience' => 'min_points',
    ])->assertStatus(422)->assertJsonValidationErrorFor('min_points');
});
