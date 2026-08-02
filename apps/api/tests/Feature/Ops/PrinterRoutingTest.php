<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Printer;
use App\Models\PrintJob;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/** A venue with a food category and a drinks category, plus a cashier signed in. */
function printVenue(): array
{
    $tenant = Tenant::factory()->create();

    $ctx = app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
        $branch = Branch::factory()->create();
        $food = Category::factory()->create(['name' => 'Yemek']);
        $drinks = Category::factory()->create(['name' => 'İçecek']);

        return [
            'tenant' => $tenant,
            'branch' => $branch,
            'food' => $food,
            'drinks' => $drinks,
            'burger' => Product::factory()->forCategory($food)->create(['name' => 'Burger', 'price' => 200]),
            'cola' => Product::factory()->forCategory($drinks)->create(['name' => 'Kola', 'price' => 50]),
            'table' => Table::factory()->create(['code' => 'M1']),
        ];
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Cashier)->create());

    return $ctx;
}

function placePrintOrder(array $ctx, array $items): int
{
    return postJson('/v1/admin/pos/orders', [
        'table_id' => $ctx['table']->id,
        'items' => $items,
    ])->assertCreated()->json('data.id');
}

it('sends each product group to its own station printer', function () {
    $ctx = printVenue();

    app(TenantManager::class)->runAs($ctx['tenant'], function () use ($ctx) {
        Printer::factory()->forCategories([$ctx['food']->id])->create(['name' => 'Mutfak', 'kind' => 'kitchen']);
        Printer::factory()->forCategories([$ctx['drinks']->id])->create(['name' => 'Bar', 'kind' => 'bar']);
    });

    placePrintOrder($ctx, [
        ['product_id' => $ctx['burger']->id, 'quantity' => 2],
        ['product_id' => $ctx['cola']->id, 'quantity' => 3],
    ]);

    app(TenantManager::class)->runAs($ctx['tenant'], function () {
        $jobs = PrintJob::with('printer')->get()->keyBy(fn ($j) => $j->printer->name);

        expect($jobs)->toHaveCount(2);
        // Mutfak fişinde yalnız burger, bar fişinde yalnız kola olmalı.
        expect(collect($jobs['Mutfak']->payload_json['lines'])->pluck('name')->all())->toBe(['Burger']);
        expect($jobs['Mutfak']->payload_json['lines'][0]['quantity'])->toBe(2);
        expect(collect($jobs['Bar']->payload_json['lines'])->pluck('name')->all())->toBe(['Kola']);
    });
});

it('prints the whole ticket on a single catch-all printer', function () {
    $ctx = printVenue();

    app(TenantManager::class)->runAs($ctx['tenant'], fn () => Printer::factory()->create(['name' => 'Tek Yazıcı']));

    placePrintOrder($ctx, [
        ['product_id' => $ctx['burger']->id, 'quantity' => 1],
        ['product_id' => $ctx['cola']->id, 'quantity' => 1],
    ]);

    app(TenantManager::class)->runAs($ctx['tenant'], function () {
        $jobs = PrintJob::get();
        expect($jobs)->toHaveCount(1);
        expect($jobs->first()->payload_json['lines'])->toHaveCount(2);
    });
});

it('falls back to the catch-all printer for a group nobody claims', function () {
    $ctx = printVenue();

    app(TenantManager::class)->runAs($ctx['tenant'], function () use ($ctx) {
        Printer::factory()->forCategories([$ctx['food']->id])->create(['name' => 'Mutfak']);
        Printer::factory()->create(['name' => 'Kasa', 'kind' => 'cashier']); // yakalayıcı
    });

    placePrintOrder($ctx, [
        ['product_id' => $ctx['burger']->id, 'quantity' => 1],
        ['product_id' => $ctx['cola']->id, 'quantity' => 1],
    ]);

    app(TenantManager::class)->runAs($ctx['tenant'], function () {
        $jobs = PrintJob::with('printer')->get()->keyBy(fn ($j) => $j->printer->name);

        // Yemek istasyonuna gitti; içecek sahipsiz kaldığı için kasada basıldı —
        // sessizce kaybolmadı.
        expect(collect($jobs['Mutfak']->payload_json['lines'])->pluck('name')->all())->toBe(['Burger']);
        expect(collect($jobs['Kasa']->payload_json['lines'])->pluck('name')->all())->toBe(['Kola']);
    });
});

it('prints only the new lines when a tab grows', function () {
    $ctx = printVenue();

    app(TenantManager::class)->runAs($ctx['tenant'], fn () => Printer::factory()->create(['name' => 'Mutfak']));

    $orderId = placePrintOrder($ctx, [['product_id' => $ctx['burger']->id, 'quantity' => 1]]);

    postJson("/v1/admin/pos/orders/{$orderId}/items", [
        'items' => [['product_id' => $ctx['cola']->id, 'quantity' => 2]],
    ])->assertOk();

    app(TenantManager::class)->runAs($ctx['tenant'], function () {
        $jobs = PrintJob::orderBy('id')->get();

        expect($jobs)->toHaveCount(2);
        expect($jobs[0]->type)->toBe('order');
        expect($jobs[1]->type)->toBe('addition');
        // Ek fişte yalnız sonradan eklenen kalem var — adisyon baştan basılmıyor.
        expect(collect($jobs[1]->payload_json['lines'])->pluck('name')->all())->toBe(['Kola']);
    });
});

it('places the order fine when no printer is configured', function () {
    $ctx = printVenue();

    $orderId = placePrintOrder($ctx, [['product_id' => $ctx['burger']->id, 'quantity' => 1]]);

    expect($orderId)->toBeInt();
    app(TenantManager::class)->runAs($ctx['tenant'], fn () => expect(PrintJob::count())->toBe(0));
});

it('lets the bridge poll its queue and acknowledge a slip', function () {
    $ctx = printVenue();
    $printer = app(TenantManager::class)->runAs($ctx['tenant'], fn () => Printer::factory()->create());

    placePrintOrder($ctx, [['product_id' => $ctx['burger']->id, 'quantity' => 1]]);

    // Köprü mutfak hesabıyla çalışır.
    Sanctum::actingAs(User::factory()->forTenant($ctx['tenant'])->role(Role::Kitchen)->create());

    $jobId = getJson('/v1/admin/print-jobs/pending?printer_id='.$printer->id)
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->json('data.0.id');

    postJson("/v1/admin/print-jobs/{$jobId}/ack", ['ok' => true])
        ->assertOk()
        ->assertJsonPath('data.status', 'printed');

    // Basılan iş kuyruktan düşer.
    getJson('/v1/admin/print-jobs/pending')->assertOk()->assertJsonCount(0, 'data');
});

it('keeps a failed slip and lets a manager retry it', function () {
    $ctx = printVenue();
    app(TenantManager::class)->runAs($ctx['tenant'], fn () => Printer::factory()->create());
    placePrintOrder($ctx, [['product_id' => $ctx['burger']->id, 'quantity' => 1]]);

    Sanctum::actingAs(User::factory()->forTenant($ctx['tenant'])->role(Role::Kitchen)->create());
    $jobId = getJson('/v1/admin/print-jobs/pending')->json('data.0.id');
    postJson("/v1/admin/print-jobs/{$jobId}/ack", ['ok' => false, 'error' => 'kağıt bitti'])
        ->assertOk()
        ->assertJsonPath('data.status', 'failed')
        ->assertJsonPath('data.error', 'kağıt bitti');

    Sanctum::actingAs(User::factory()->forTenant($ctx['tenant'])->role(Role::Manager)->create());
    postJson("/v1/admin/print-jobs/{$jobId}/retry")->assertOk()->assertJsonPath('data.status', 'pending');
});

it('queues a test slip from the panel', function () {
    $ctx = printVenue();
    $printer = app(TenantManager::class)->runAs($ctx['tenant'], fn () => Printer::factory()->create());

    Sanctum::actingAs(User::factory()->forTenant($ctx['tenant'])->role(Role::Manager)->create());

    postJson("/v1/admin/printers/{$printer->id}/test")
        ->assertCreated()
        ->assertJsonPath('data.type', 'test');
});

it('never routes a ticket to another tenant\'s printer', function () {
    $other = Tenant::factory()->create();
    $foreign = app(TenantManager::class)->runAs($other, fn () => Printer::factory()->create(['name' => 'Komşu']));

    $ctx = printVenue();
    app(TenantManager::class)->runAs($ctx['tenant'], fn () => Printer::factory()->create(['name' => 'Bizim']));

    placePrintOrder($ctx, [['product_id' => $ctx['burger']->id, 'quantity' => 1]]);

    app(TenantManager::class)->runAs($other, fn () => expect(PrintJob::count())->toBe(0));
    app(TenantManager::class)->runAs($ctx['tenant'], function () use ($foreign) {
        expect(PrintJob::count())->toBe(1);
        expect(PrintJob::first()->printer_id)->not->toBe($foreign->id);
    });

    // Komşunun yazıcısı panelden de görünmez/düzenlenemez.
    Sanctum::actingAs(User::factory()->forTenant($ctx['tenant'])->role(Role::Manager)->create());
    getJson('/v1/admin/printers')->assertOk()->assertJsonCount(1, 'data');
});

it('rejects a category from another tenant in the routing map', function () {
    $other = Tenant::factory()->create();
    $foreignCategory = app(TenantManager::class)->runAs($other, fn () => Category::factory()->create());

    $ctx = printVenue();
    Sanctum::actingAs(User::factory()->forTenant($ctx['tenant'])->role(Role::Manager)->create());

    postJson('/v1/admin/printers', [
        'name' => 'Sızıntı',
        'kind' => 'kitchen',
        'category_ids_json' => [$foreignCategory->id],
    ])->assertStatus(422)->assertJsonValidationErrors('category_ids_json.0');
});
