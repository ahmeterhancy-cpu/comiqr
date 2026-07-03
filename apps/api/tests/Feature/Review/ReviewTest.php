<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Customer;
use App\Models\LoyaltyAccount;
use App\Models\Product;
use App\Models\Review;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

function seedReviewable(): array
{
    $tenant = Tenant::factory()->slug('review-venue')->create();

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        Branch::factory()->create();
        $cat = Category::factory()->create();
        $product = Product::factory()->forCategory($cat)->create(['price' => 100]);
        $table = Table::factory()->create(['code' => 'M1']);

        return compact('tenant', 'product', 'table');
    });
}

function placeReviewOrder(Table $table, Product $product, array $extra = []): string
{
    return postJson("/v1/sessions/{$table->qr_token}/orders", array_merge([
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ], $extra))->json('data.id');
}

it('lets a customer review an order once and reflects the reviewed state', function () {
    ['product' => $product, 'table' => $table] = seedReviewable();
    $orderId = placeReviewOrder($table, $product);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/review", ['rating' => 5, 'comment' => 'Harika!'])
        ->assertCreated()
        ->assertJsonPath('data.rating', 5)
        ->assertJsonPath('data.comment', 'Harika!');

    getJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}")
        ->assertOk()
        ->assertJsonPath('data.reviewed', true);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/review", ['rating' => 3])->assertStatus(422);
});

it('validates the rating range', function () {
    ['product' => $product, 'table' => $table] = seedReviewable();
    $orderId = placeReviewOrder($table, $product);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/review", ['rating' => 6])->assertStatus(422);
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/review", ['rating' => 0])->assertStatus(422);
});

it('exposes venue reputation on the menu and lists reviews publicly', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = seedReviewable();
    $orderId = placeReviewOrder($table, $product);
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/review", ['rating' => 4, 'comment' => 'İyiydi'])->assertCreated();

    getJson("/v1/menu/{$table->qr_token}")
        ->assertOk()
        ->assertJsonPath('data.venue.reviews_count', 1)
        ->assertJsonPath('data.venue.rating', 4);

    getJson("/v1/venues/{$tenant->slug}/reviews")
        ->assertOk()
        ->assertJsonPath('data.reputation.count', 1)
        ->assertJsonPath('data.reviews.0.comment', 'İyiydi');
});

it('lets the owner list, reply and hide reviews (moderation)', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = seedReviewable();
    $orderId = placeReviewOrder($table, $product);
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/review", ['rating' => 2, 'comment' => 'Yavaş'])->assertCreated();
    $reviewId = Review::withoutTenancy()->where('order_id', $orderId)->value('id');

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/reviews')
        ->assertOk()
        ->assertJsonPath('data.reviews.0.comment', 'Yavaş')
        ->assertJsonPath('data.reputation.count', 1);

    postJson("/v1/admin/reviews/{$reviewId}/reply", ['reply' => 'Özür dileriz!'])
        ->assertOk()
        ->assertJsonPath('data.reply', 'Özür dileriz!');

    postJson("/v1/admin/reviews/{$reviewId}/status", ['status' => 'hidden'])->assertOk();

    // A hidden review no longer counts toward the public reputation.
    getJson("/v1/menu/{$table->qr_token}")->assertOk()->assertJsonPath('data.venue.reviews_count', 0);
});

it('awards loyalty points for a review when the customer is identified', function () {
    ['product' => $product, 'table' => $table] = seedReviewable();
    $orderId = placeReviewOrder($table, $product, ['customer' => ['phone' => '+905331112233']]);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/review", ['rating' => 5])->assertCreated();

    $customer = Customer::withoutTenancy()->first();
    $account = LoyaltyAccount::where('customer_id', $customer->id)->first();
    expect((int) $account->points_balance)->toBeGreaterThanOrEqual(20);
});
