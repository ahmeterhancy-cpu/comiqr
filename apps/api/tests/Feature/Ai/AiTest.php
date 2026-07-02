<?php

use App\AI\AiProvider;
use App\AI\NullAiProvider;
use App\Enums\Role;
use App\Models\Category;
use App\Models\Plan;
use App\Models\Product;
use App\Models\ProductTranslation;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

/** Deterministic AI provider so tests never call a real API. */
function fakeAi(): void
{
    app()->instance(AiProvider::class, new class implements AiProvider
    {
        public function isConfigured(): bool
        {
            return true;
        }

        public function complete(string $system, string $prompt): string
        {
            return 'AI: '.substr($prompt, 0, 40);
        }
    });
}

function aiVenue(string $plan = 'pro'): array
{
    $tenant = Tenant::factory()->create(['plan_id' => Plan::firstWhere('code', $plan)->id]);
    $product = app(TenantManager::class)->runAs($tenant, fn () => Product::factory()
        ->forCategory(Category::factory()->create())
        ->create(['name' => 'Hellim Izgara', 'description' => null]));

    return [$tenant, $product];
}

it('generates and saves product copy', function () {
    fakeAi();
    [$tenant, $product] = aiVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/ai/product-copy', ['product_id' => $product->id, 'save' => true])
        ->assertOk()
        ->assertJsonPath('data.product_id', $product->id);

    expect($product->fresh()->description)->toStartWith('AI:');
});

it('translates the menu into a locale', function () {
    fakeAi();
    [$tenant, $product] = aiVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/ai/translate-menu', ['locale' => 'en'])
        ->assertOk()
        ->assertJsonPath('data.translated', 1);

    $translation = app(TenantManager::class)->runAs($tenant, fn () => ProductTranslation::where('product_id', $product->id)->where('locale', 'en')->first());
    expect($translation)->not->toBeNull()->and($translation->name)->toStartWith('AI:');
});

it('returns 503 when AI is not configured', function () {
    app()->instance(AiProvider::class, new NullAiProvider);
    [$tenant, $product] = aiVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/ai/product-copy', ['product_id' => $product->id])->assertStatus(503);
});

it('gates AI behind the plan', function () {
    fakeAi();
    [$tenant, $product] = aiVenue('free');
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson('/v1/admin/ai/product-copy', ['product_id' => $product->id])->assertStatus(402);
});
