<?php

use App\AI\AiProvider;
use App\AI\VisionProvider;
use App\Enums\Role;
use App\Models\Category;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(Database\Seeders\PlanSeeder::class));

/** Vision-capable fake returning a canned menu JSON (never hits a real API). */
function bindVisionAi(?string $json = null): void
{
    $out = $json ?? json_encode([
        'categories' => [[
            'name' => 'Tatlılar',
            'products' => [
                ['name' => 'Baklava', 'description' => 'Antep fıstıklı', 'price' => 90, 'variants' => [
                    ['name' => 'Porsiyon', 'price' => 90],
                    ['name' => 'Yarım Kilo', 'price' => 320],
                ]],
                ['name' => 'Sütlaç', 'description' => null, 'price' => 60],
            ],
        ]],
    ]);

    app()->instance(AiProvider::class, new class($out) implements AiProvider, VisionProvider
    {
        public function __construct(private string $out) {}

        public function isConfigured(): bool
        {
            return true;
        }

        public function complete(string $system, string $prompt): string
        {
            return '';
        }

        public function completeWithImages(string $system, string $prompt, array $media, int $maxTokens = 4096): string
        {
            return $this->out;
        }
    });
}

function importManager(string $plan = 'pro'): User
{
    $tenant = Tenant::factory()->create(['plan_id' => Plan::firstWhere('code', $plan)->id]);

    return User::factory()->forTenant($tenant)->role(Role::Manager)->create();
}

it('imports a menu from a photo into categories, products and variants', function () {
    bindVisionAi();
    Sanctum::actingAs(importManager('pro'));

    postJson('/v1/admin/ai/import-menu', ['files' => [UploadedFile::fake()->image('menu.jpg')]])
        ->assertCreated()
        ->assertJsonPath('data.categories', 1)
        ->assertJsonPath('data.products', 2);

    expect(Category::withoutTenancy()->where('name', 'Tatlılar')->exists())->toBeTrue();

    $baklava = Product::withoutTenancy()->where('name', 'Baklava')->first();
    expect((float) $baklava->price)->toBe(90.0);              // smallest variant becomes the base
    expect($baklava->variants()->count())->toBe(2);
    // AI gives absolute prices; stored as a delta from the base.
    expect((float) $baklava->variants()->where('name', 'Yarım Kilo')->value('price_delta'))->toBe(230.0);
});

it('gates photo import behind the ai plan feature', function () {
    bindVisionAi();
    Sanctum::actingAs(importManager('free'));

    postJson('/v1/admin/ai/import-menu', ['files' => [UploadedFile::fake()->image('m.jpg')]])
        ->assertStatus(402);
});

it('returns 503 when the provider cannot read images', function () {
    app()->instance(AiProvider::class, new class implements AiProvider
    {
        public function isConfigured(): bool
        {
            return true;
        }

        public function complete(string $system, string $prompt): string
        {
            return '';
        }
    });
    Sanctum::actingAs(importManager('pro'));

    postJson('/v1/admin/ai/import-menu', ['files' => [UploadedFile::fake()->image('m.jpg')]])
        ->assertStatus(503);
});

it('validates that files are provided', function () {
    bindVisionAi();
    Sanctum::actingAs(importManager('pro'));

    postJson('/v1/admin/ai/import-menu', [])->assertStatus(422)->assertJsonValidationErrors('files');
});

it('422s when the AI extracts no products', function () {
    bindVisionAi(json_encode(['categories' => []]));
    Sanctum::actingAs(importManager('pro'));

    postJson('/v1/admin/ai/import-menu', ['files' => [UploadedFile::fake()->image('m.jpg')]])
        ->assertStatus(422);
});

it('forbids non-managers from importing', function () {
    bindVisionAi();
    $tenant = Tenant::factory()->create(['plan_id' => Plan::firstWhere('code', 'pro')->id]);
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    postJson('/v1/admin/ai/import-menu', ['files' => [UploadedFile::fake()->image('m.jpg')]])
        ->assertForbidden();
});
