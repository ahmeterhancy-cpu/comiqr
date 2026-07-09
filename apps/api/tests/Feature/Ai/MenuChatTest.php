<?php

use App\AI\AiProvider;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

/** Deterministic provider; proves the menu context reaches the model via the system prompt. */
function bindChatAi(bool $configured = true): void
{
    app()->instance(AiProvider::class, new class($configured) implements AiProvider
    {
        public function __construct(private bool $ok) {}

        public function isConfigured(): bool
        {
            return $this->ok;
        }

        public function complete(string $system, string $prompt): string
        {
            return str_contains($system, 'Köfte') ? 'Evet, Köfte menümüzde var.' : 'Menümde bu bilgi yok.';
        }
    });
}

function chatVenue(string $plan = 'pro'): Tenant
{
    $tenant = Tenant::factory()->create(['plan_id' => Plan::firstWhere('code', $plan)->id]);

    app(TenantManager::class)->runAs($tenant, function () {
        Branch::factory()->create();
        $cat = Category::factory()->create(['name' => 'Ana Yemek']);
        Product::factory()->forCategory($cat)->create(['name' => 'Köfte', 'price' => 120, 'is_active' => true]);
    });

    return $tenant;
}

it('answers a guest question strictly from the menu (ai plan)', function () {
    bindChatAi();
    $tenant = chatVenue('pro');

    postJson('/v1/menu/chat?tenant='.$tenant->slug, ['question' => 'Köfte var mı?'])
        ->assertOk()
        ->assertJsonPath('data.answer', 'Evet, Köfte menümüzde var.');
});

it('gates the guest chatbot behind the ai plan feature', function () {
    bindChatAi();
    $tenant = chatVenue('free'); // free plan lacks the ai feature

    postJson('/v1/menu/chat?tenant='.$tenant->slug, ['question' => 'Merhaba'])
        ->assertStatus(402);
});

it('returns 503 when no AI provider is configured', function () {
    bindChatAi(false);
    $tenant = chatVenue('pro');

    postJson('/v1/menu/chat?tenant='.$tenant->slug, ['question' => 'Merhaba'])
        ->assertStatus(503);
});

it('requires a question', function () {
    bindChatAi();
    $tenant = chatVenue('pro');

    postJson('/v1/menu/chat?tenant='.$tenant->slug, [])
        ->assertStatus(422)->assertJsonValidationErrors('question');
});

it('exposes ai_chat + slug on the public menu payload', function () {
    bindChatAi();
    $tenant = chatVenue('pro');

    $venue = \Pest\Laravel\getJson('/v1/menu?tenant='.$tenant->slug)->assertOk()->json('data.venue');
    expect($venue['ai_chat'])->toBeTrue();
    expect($venue['slug'])->toBe($tenant->slug);
});
