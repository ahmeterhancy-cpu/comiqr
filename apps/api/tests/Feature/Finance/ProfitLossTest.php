<?php

use App\Enums\Role;
use App\Models\Account;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\NutritionSummary;
use App\Models\Order;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/** Product with a known recipe cost. */
function plProduct(Category $category, string $name, float $price, ?float $cost): Product
{
    $product = Product::factory()->forCategory($category)->create(['name' => $name, 'price' => $price]);

    if ($cost !== null) {
        NutritionSummary::create([
            'product_id' => $product->id,
            'cost_per_portion' => $cost,
            'is_stale' => false,
            'computed_at' => now(),
        ]);
    }

    return $product;
}

/** A sold line with the cost frozen onto it, exactly as the POS writes it. */
function plSale(Branch $branch, Product $product, int $qty, ?float $unitCost, ?string $placedAt = null): Order
{
    $order = Order::factory()->create([
        'branch_id' => $branch->id,
        'placed_at' => $placedAt ? Carbon::parse($placedAt) : now(),
        'status' => 'served',
    ]);

    $order->items()->create([
        'product_id' => $product->id,
        'quantity' => $qty,
        'unit_price' => $product->price,
        'unit_cost' => $unitCost,
        'line_total' => (float) $product->price * $qty,
        'status' => 'served',
    ]);

    $order->recalculateTotals();

    return $order->fresh();
}

it('computes net sales, COGS, expenses and profit', function () {
    $tenant = Tenant::factory()->create();

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();

        $burger = plProduct($category, 'Burger', 100, 40);
        $ayran = plProduct($category, 'Ayran', 20, 6);

        plSale($branch, $burger, 3, 40);   // 300 ciro · 120 maliyet
        plSale($branch, $ayran, 5, 6);     // 100 ciro ·  30 maliyet

        ExpenseCategory::factory()->create(['name' => 'Kira']);
        Expense::factory()->create([
            'description' => 'Kira',
            'amount' => 150,
            'tax_amount' => 30,
            'spent_on' => now()->toDateString(),
            'branch_id' => $branch->id,
        ]);
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = getJson('/v1/admin/reports/profit-loss')->assertOk();

    $res->assertJsonPath('data.sales.gross_sales', 400)
        ->assertJsonPath('data.sales.net_sales', 400)
        ->assertJsonPath('data.cogs.cogs', 150)
        ->assertJsonPath('data.expenses.total', 150)
        ->assertJsonPath('data.expenses.tax', 30)
        ->assertJsonPath('data.gross_profit', 250)          // 400 − 150
        ->assertJsonPath('data.net_profit', 100)            // 250 − 150
        ->assertJsonPath('data.gross_margin_pct', 62.5)
        ->assertJsonPath('data.net_margin_pct', 25);
});

it('prices old sales at the cost frozen on the line, not today\'s recipe cost', function () {
    $tenant = Tenant::factory()->create();

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        // Bugünkü reçete maliyeti 90'a fırladı; satış 30'a yapılmıştı.
        $product = plProduct(Category::factory()->create(), 'Köfte', 200, 90);
        plSale($branch, $product, 2, 30);
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/reports/profit-loss')
        ->assertOk()
        ->assertJsonPath('data.cogs.cogs', 60)      // 2 × 30, 2 × 90 değil
        ->assertJsonPath('data.gross_profit', 340);
});

it('falls back to the current recipe cost and flags sales that carry no cost at all', function () {
    $tenant = Tenant::factory()->create();

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $category = Category::factory()->create();

        // Anlık görüntüden önceki satır → güncel reçete maliyetine düşer.
        plSale($branch, plProduct($category, 'Eski Satır', 100, 25), 2, null);
        // Reçetesi hiç olmayan ürün → maliyeti bilinmiyor, 0 sayılır ama raporlanır.
        plSale($branch, plProduct($category, 'Recetesiz', 50, null), 4, null);
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/reports/profit-loss')
        ->assertOk()
        ->assertJsonPath('data.cogs.cogs', 50)              // yalnız 2 × 25
        ->assertJsonPath('data.cogs.uncosted_sales', 200)   // 4 × 50
        ->assertJsonPath('data.cogs.coverage_pct', 50);     // 400 cironun 200'ü maliyetli
});

it('separates the accrual view from the cash view for a veresiye sale', function () {
    $tenant = Tenant::factory()->create();

    $ctx = app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $product = plProduct(Category::factory()->create(), 'Tost', 100, 30);
        $table = Table::factory()->create(['code' => 'M1']);
        $account = Account::factory()->customer()->create();

        return compact('product', 'table', 'account', 'branch');
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Cashier)->create());

    $orderId = postJson('/v1/admin/pos/orders', [
        'table_id' => $ctx['table']->id,
        'items' => [['product_id' => $ctx['product']->id, 'quantity' => 1]],
    ])->assertCreated()->json('data.id');

    postJson("/v1/admin/pos/orders/{$orderId}/charge-account", ['account_id' => $ctx['account']->id])->assertOk();

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/reports/profit-loss')
        ->assertOk()
        // Satış bugün gerçekleşti → ciro ve kâr bugüne yazılır…
        ->assertJsonPath('data.sales.net_sales', 100)
        ->assertJsonPath('data.cogs.cogs', 30)
        ->assertJsonPath('data.gross_profit', 70)
        // …ama para henüz kasada değil, veresiye olarak ayrı görünür.
        ->assertJsonPath('data.cash.credit_sales', 100)
        ->assertJsonPath('data.cash.by_tender.credit', 100);
});

it('leaves cancelled orders and voided lines out of both sides', function () {
    $tenant = Tenant::factory()->create();

    app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        $product = plProduct(Category::factory()->create(), 'Pide', 100, 40);

        plSale($branch, $product, 1, 40);

        $cancelled = plSale($branch, $product, 5, 40);
        $cancelled->update(['status' => 'cancelled']);

        $voided = plSale($branch, $product, 3, 40);
        $voided->items()->update(['status' => 'cancelled']);
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    // İptal edilen sipariş satışa da maliyete de girmez; kalem iptali maliyeti düşürür.
    getJson('/v1/admin/reports/profit-loss')
        ->assertOk()
        ->assertJsonPath('data.cogs.cogs', 40);
});

it('honours the date range and the branch filter', function () {
    $tenant = Tenant::factory()->create();

    $branches = app(TenantManager::class)->runAs($tenant, function () {
        $a = Branch::factory()->create(['name' => 'Merkez']);
        $b = Branch::factory()->create(['name' => 'Sahil']);
        $product = plProduct(Category::factory()->create(), 'Çay', 10, 3);

        plSale($a, $product, 10, 3);
        plSale($b, $product, 4, 3);
        plSale($a, $product, 100, 3, now()->copy()->subMonths(2)->toDateTimeString()); // aralık dışı

        return compact('a', 'b');
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/reports/profit-loss')->assertOk()->assertJsonPath('data.sales.net_sales', 140);

    getJson('/v1/admin/reports/profit-loss?branch_id='.$branches['b']->id)
        ->assertOk()
        ->assertJsonPath('data.sales.net_sales', 40)
        ->assertJsonPath('data.cogs.cogs', 12);
});

it('keeps branch-less overhead in a branch-filtered report', function () {
    $tenant = Tenant::factory()->create();

    $branch = app(TenantManager::class)->runAs($tenant, function () {
        $branch = Branch::factory()->create();
        plSale($branch, plProduct(Category::factory()->create(), 'Menemen', 100, 30), 2, 30);

        // Şubeye yazılan gider + tüm işletmeyi ilgilendiren şubesiz gider.
        Expense::factory()->create(['amount' => 50, 'spent_on' => now()->toDateString(), 'branch_id' => $branch->id]);
        Expense::factory()->create(['amount' => 120, 'spent_on' => now()->toDateString(), 'branch_id' => null]);

        return $branch;
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/reports/profit-loss?branch_id='.$branch->id)
        ->assertOk()
        ->assertJsonPath('data.expenses.total', 170)   // 50 + 120, kira kaybolmaz
        ->assertJsonPath('data.net_profit', -30);      // 200 − 60 − 170 → zarar
});

it('never mixes another tenant\'s sales or expenses into the report', function () {
    $other = Tenant::factory()->create();
    app(TenantManager::class)->runAs($other, function () {
        $branch = Branch::factory()->create();
        plSale($branch, plProduct(Category::factory()->create(), 'Komşu', 999, 1), 10, 1);
        Expense::factory()->create(['amount' => 5000, 'spent_on' => now()->toDateString()]);
    });

    $tenant = Tenant::factory()->create();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    getJson('/v1/admin/reports/profit-loss')
        ->assertOk()
        ->assertJsonPath('data.sales.net_sales', 0)
        ->assertJsonPath('data.cogs.cogs', 0)
        ->assertJsonPath('data.expenses.total', 0)
        ->assertJsonPath('data.net_profit', 0);
});

it('exports the daily breakdown as CSV', function () {
    $tenant = Tenant::factory()->create();
    app(TenantManager::class)->runAs($tenant, function () {
        plSale(Branch::factory()->create(), plProduct(Category::factory()->create(), 'Simit', 25, 8), 4, 8);
    });

    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = getJson('/v1/admin/reports/profit-loss.csv')->assertOk();
    $csv = $res->streamedContent();

    expect($csv)->toContain('Net Satış')->toContain('TOPLAM')->toContain('100');
});
