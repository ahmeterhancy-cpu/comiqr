<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\DiningArea;
use App\Models\Order;
use App\Models\Product;
use App\Models\Table;
use App\Models\TableSession;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/** Seed a venue with one dining area of $areaType holding a single "101" table. */
function seedVenue(string $vertical = 'hotel', string $areaType = 'room'): array
{
    $tenant = Tenant::factory()->create(['settings_json' => ['vertical' => $vertical]]);

    return app(TenantManager::class)->runAs($tenant, function () use ($tenant, $areaType) {
        $branch = Branch::factory()->create();
        $area = DiningArea::factory()->create(['branch_id' => $branch->id, 'name' => 'Odalar', 'type' => $areaType]);
        $cat = Category::factory()->create();
        $product = Product::factory()->forCategory($cat)->create(['price' => 200]);
        $table = Table::factory()->create(['branch_id' => $branch->id, 'dining_area_id' => $area->id, 'code' => '101']);

        return compact('tenant', 'product', 'table');
    });
}

function placeRoomOrder(Table $table, Product $product): string
{
    return postJson("/v1/sessions/{$table->qr_token}/orders", [
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
    ])->json('data.id');
}

it('charges a room-service order to the room folio (hotel + room QR)', function () {
    ['product' => $product, 'table' => $table] = seedVenue('hotel', 'room');
    $orderId = placeRoomOrder($table, $product);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/charge-to-room")
        ->assertOk()
        ->assertJsonPath('data.charged_to_room', true)
        ->assertJsonPath('data.payment_status', 'unpaid');

    expect(Order::find($orderId)->charged_to_room)->toBeTrue();
});

it('rejects charge-to-room for non-hotel tenants', function () {
    ['product' => $product, 'table' => $table] = seedVenue('restaurant', 'room');
    $orderId = placeRoomOrder($table, $product);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/charge-to-room")->assertStatus(422);
});

it('rejects charge-to-room when the QR does not belong to a room', function () {
    ['product' => $product, 'table' => $table] = seedVenue('hotel', 'table');
    $orderId = placeRoomOrder($table, $product);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/charge-to-room")->assertStatus(422);
});

it('will not charge an already-paid order to the room', function () {
    ['product' => $product, 'table' => $table] = seedVenue('hotel', 'room');
    $orderId = placeRoomOrder($table, $product);
    Order::find($orderId)->update(['payment_status' => 'paid']);

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/charge-to-room")->assertStatus(422);
});

it('lists open room folios for the front desk', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = seedVenue('hotel', 'room');
    $orderId = placeRoomOrder($table, $product);
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/charge-to-room")->assertOk();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/hotel/folio')
        ->assertOk()
        ->assertJsonPath('data.0.code', '101')
        ->assertJsonPath('data.0.order_count', 1)
        ->assertJsonPath('data.0.total', 200);
});

it('settles a room at check-out and closes its open session', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = seedVenue('hotel', 'room');
    $orderId = placeRoomOrder($table, $product);
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/charge-to-room")->assertOk();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson("/v1/admin/hotel/rooms/{$table->id}/settle")
        ->assertOk()
        ->assertJsonPath('data.settled_count', 1)
        ->assertJsonPath('data.settled_total', 200);

    expect(Order::find($orderId)->payment_status)->toBe('paid');
    expect(TableSession::where('table_id', $table->id)->where('status', 'open')->count())->toBe(0);

    getJson('/v1/admin/hotel/folio')->assertOk()->assertJsonCount(0, 'data');
});

it('exposes vertical + is_room on the QR menu payload', function () {
    ['table' => $roomTable] = seedVenue('hotel', 'room');
    getJson("/v1/menu/{$roomTable->qr_token}")
        ->assertOk()
        ->assertJsonPath('data.venue.vertical', 'hotel')
        ->assertJsonPath('data.table.is_room', true);

    ['table' => $restTable] = seedVenue('restaurant', 'table');
    getJson("/v1/menu/{$restTable->qr_token}")
        ->assertOk()
        ->assertJsonPath('data.venue.vertical', 'restaurant')
        ->assertJsonPath('data.table.is_room', false);
});

it('refuses the folio/settle when no tenant is bound (superadmin token)', function () {
    ['table' => $table] = seedVenue('hotel', 'room');
    Sanctum::actingAs(User::factory()->superadmin()->create(['email' => 'root-hotel@comiqr.com']));

    getJson('/v1/admin/hotel/folio')->assertStatus(403);
    postJson("/v1/admin/hotel/rooms/{$table->id}/settle")->assertStatus(403);
});

it('blocks paying an order that was charged to the room (settled at check-out)', function () {
    ['product' => $product, 'table' => $table] = seedVenue('hotel', 'room');
    $orderId = placeRoomOrder($table, $product);
    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/charge-to-room")->assertOk();

    postJson("/v1/sessions/{$table->qr_token}/orders/{$orderId}/pay", ['gateway' => 'cash'])->assertStatus(422);
});

it('leaves a non-folio unpaid order and its session intact after settle', function () {
    ['tenant' => $tenant, 'product' => $product, 'table' => $table] = seedVenue('hotel', 'room');
    $a = placeRoomOrder($table, $product);
    postJson("/v1/sessions/{$table->qr_token}/orders/{$a}/charge-to-room")->assertOk();
    $b = placeRoomOrder($table, $product); // ordered, neither paid nor charged to room

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    postJson("/v1/admin/hotel/rooms/{$table->id}/settle")
        ->assertOk()
        ->assertJsonPath('data.settled_count', 1)
        ->assertJsonPath('data.sessions_open', 1);

    expect(Order::find($a)->payment_status)->toBe('paid');
    expect(Order::find($b)->payment_status)->toBe('unpaid');
    expect(TableSession::where('table_id', $table->id)->where('status', 'open')->count())->toBe(1);
});
