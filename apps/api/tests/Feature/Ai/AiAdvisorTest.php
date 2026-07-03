<?php

use App\AI\AiProvider;
use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

/** Deterministic AI provider so tests never hit a real API. */
function fakeAdvisor(): void
{
    app()->instance(AiProvider::class, new class implements AiProvider
    {
        public function isConfigured(): bool
        {
            return true;
        }

        public function complete(string $system, string $prompt): string
        {
            return 'ÖNERİ: '.substr($prompt, 0, 30);
        }
    });
}

function advisorVenue(string $plan = 'business'): array
{
    $tenant = Tenant::factory()->create(['plan_id' => Plan::firstWhere('code', $plan)->id]);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $cat = Category::factory()->create();
        $product = Product::factory()->forCategory($cat)->create(['price' => 100]);
        $table = Table::factory()->create(['code' => 'M1']);

        return compact('tenant', 'product', 'table');
    });
}

it('generates AI menu insights from recent sales (business plan)', function () {
    fakeAdvisor();
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = advisorVenue('business');

    postJson("/v1/sessions/{$table->qr_token}/orders", ['items' => [['product_id' => $product->id, 'quantity' => 2]]])->assertCreated();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/ai/menu-insights')
        ->assertOk()
        ->assertJsonPath('data.products', 1)
        ->assertJsonStructure(['data' => ['insights']]);
});

it('summarises reviews with AI (business plan)', function () {
    fakeAdvisor();
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = advisorVenue('business');
    $orderId = postJson("/v1/sessions/{$table->qr_token}/orders", ['items' => [['product_id' => $product->id, 'quantity' => 1]]])->json('data.id');
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/review", ['rating' => 5, 'comment' => 'Harika'])->assertCreated();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/ai/review-summary')
        ->assertOk()
        ->assertJsonPath('data.reviews', 1)
        ->assertJsonStructure(['data' => ['summary']]);
});

it('gates the AI advisor behind the ai_advanced plan feature', function () {
    fakeAdvisor();
    ['tenant' => $tenant] = advisorVenue('pro'); // pro lacks ai_advanced
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/ai/menu-insights')->assertStatus(402);
    postJson('/v1/admin/ai/review-summary')->assertStatus(402);
});

it('returns 422 when there is nothing to analyse', function () {
    fakeAdvisor();
    ['tenant' => $tenant] = advisorVenue('business');
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/ai/menu-insights')->assertStatus(422);
    postJson('/v1/admin/ai/review-summary')->assertStatus(422);
});
