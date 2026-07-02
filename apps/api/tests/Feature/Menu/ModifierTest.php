<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Modifier;
use App\Models\ModifierGroup;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/**
 * Seed a tenant with one orderable product and a table, plus an optional
 * modifier group attached to the product. Returns the created models.
 *
 * @param  array<string,mixed>  $groupAttrs
 * @param  array<int,array{name:string,price_delta:float}>  $options
 */
function seedWithModifiers(array $groupAttrs = [], array $options = []): array
{
    $tenant = Tenant::factory()->create();

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant, $groupAttrs, $options) {
        Branch::factory()->create();
        $product = Product::factory()->forCategory(Category::factory()->create())->create(['price' => 100]);
        $table = Table::factory()->create(['code' => 'M1']);

        $group = null;
        $modifiers = [];
        if ($groupAttrs) {
            $group = ModifierGroup::factory()->create($groupAttrs);
            foreach ($options as $opt) {
                $modifiers[] = Modifier::create(['modifier_group_id' => $group->id] + $opt);
            }
            $product->modifierGroups()->attach($group->id);
        }

        return compact('tenant', 'product', 'table', 'group', 'modifiers');
    });
}

it('exposes a product\'s modifier groups and options on the public menu', function () {
    ['table' => $table] = seedWithModifiers(
        ['name' => 'Ekstra Malzeme', 'min_select' => 0, 'max_select' => 3, 'is_required' => false],
        [['name' => 'Ekstra Hellim', 'price_delta' => 40], ['name' => 'Ceviz', 'price_delta' => 25]],
    );

    getJson("/v1/menu/{$table->qr_token}")
        ->assertOk()
        ->assertJsonPath('data.categories.0.products.0.modifier_groups.0.name', 'Ekstra Malzeme')
        ->assertJsonPath('data.categories.0.products.0.modifier_groups.0.max_select', 3)
        ->assertJsonPath('data.categories.0.products.0.modifier_groups.0.is_required', false)
        ->assertJsonCount(2, 'data.categories.0.products.0.modifier_groups.0.modifiers')
        ->assertJsonPath('data.categories.0.products.0.modifier_groups.0.modifiers.0.name', 'Ekstra Hellim');
});

it('lets a manager create a group, add options, attach to a product and delete it', function () {
    $tenant = Tenant::factory()->create();
    $product = app(TenantManager::class)->runAs($tenant, fn () => Product::factory()
        ->forCategory(Category::factory()->create())->create(['price' => 100]));
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $groupId = postJson('/v1/admin/modifier-groups', [
        'name' => 'Sos Seçimi', 'min_select' => 1, 'max_select' => 1, 'is_required' => true,
    ])->assertCreated()->assertJsonPath('data.name', 'Sos Seçimi')->json('data.id');

    postJson("/v1/admin/modifier-groups/{$groupId}/modifiers", ['name' => 'Acı Sos', 'price_delta' => 0])
        ->assertCreated()->assertJsonPath('data.name', 'Acı Sos');

    postJson("/v1/admin/products/{$product->id}/modifier-groups", ['modifier_group_id' => $groupId])
        ->assertOk()->assertJsonPath('data.attached', true);

    // Appears in the group index with the product attached.
    getJson('/v1/admin/modifier-groups')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Sos Seçimi')
        ->assertJsonPath('data.0.product_ids.0', $product->id);

    expect(app(TenantManager::class)->runAs($tenant, fn () => $product->fresh()->modifierGroups()->count()))->toBe(1);

    deleteJson("/v1/admin/modifier-groups/{$groupId}")->assertOk();
    expect(app(TenantManager::class)->runAs($tenant, fn () => $product->fresh()->modifierGroups()->count()))->toBe(0);
});

it('rejects a modifier that is not one of the product\'s options', function () {
    ['table' => $table, 'product' => $product] = seedWithModifiers();

    // A modifier from an unrelated group (never attached to the product).
    $stray = app(TenantManager::class)->runAs($product->tenant, function () {
        $group = ModifierGroup::factory()->create();

        return Modifier::create(['modifier_group_id' => $group->id, 'name' => 'Yabancı', 'price_delta' => 10]);
    });

    postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1, 'modifiers' => [$stray->id]]],
    ])->assertStatus(422)->assertJsonValidationErrorFor('items');
});

it('enforces a group\'s max_select', function () {
    ['table' => $table, 'product' => $product, 'modifiers' => $mods] = seedWithModifiers(
        ['name' => 'Ekstra', 'min_select' => 0, 'max_select' => 1, 'is_required' => false],
        [['name' => 'A', 'price_delta' => 5], ['name' => 'B', 'price_delta' => 5]],
    );

    postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1, 'modifiers' => [$mods[0]->id, $mods[1]->id]]],
    ])->assertStatus(422)->assertJsonValidationErrorFor('items');
});

it('enforces a required group and accepts a valid single selection', function () {
    ['table' => $table, 'product' => $product, 'modifiers' => $mods] = seedWithModifiers(
        ['name' => 'Pişme Derecesi', 'min_select' => 1, 'max_select' => 1, 'is_required' => true],
        [['name' => 'Az', 'price_delta' => 0], ['name' => 'İyi', 'price_delta' => 0]],
    );

    // Missing the required choice → rejected.
    postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->assertStatus(422)->assertJsonValidationErrorFor('items');

    // A single valid choice → accepted.
    postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1, 'modifiers' => [$mods[0]->id]]],
    ])->assertCreated()->assertJsonPath('data.items.0.modifiers.0.name', 'Az');
});
