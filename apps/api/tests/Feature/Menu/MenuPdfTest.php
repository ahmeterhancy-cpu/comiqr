<?php

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

function pdfVenue(): Tenant
{
    $tenant = Tenant::factory()->create(['name' => 'Girne Meze']);

    app(TenantManager::class)->runAs($tenant, function () {
        Branch::factory()->create();
        $cat = Category::factory()->create(['name' => 'Tatlılar']);
        $p = Product::factory()->forCategory($cat)->create(['name' => 'Baklava', 'price' => 90]);
        $p->variants()->create(['name' => 'Yarım Kilo', 'price_delta' => 230, 'is_default' => false, 'sort' => 0]);
    });

    return $tenant;
}

it('renders and downloads the menu as a PDF for a manager', function () {
    $tenant = pdfVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Manager)->create());

    $res = $this->get('/v1/admin/menu/pdf')->assertOk();

    expect($res->headers->get('content-type'))->toContain('application/pdf');
    expect($res->headers->get('content-disposition'))->toContain('menu-'.$tenant->slug.'.pdf');
    // dompdf output is a real PDF (magic header).
    expect(substr($res->getContent(), 0, 4))->toBe('%PDF');
});

it('forbids non-managers from downloading the menu PDF', function () {
    $tenant = pdfVenue();
    Sanctum::actingAs(User::factory()->forTenant($tenant)->role(Role::Waiter)->create());

    $this->get('/v1/admin/menu/pdf')->assertForbidden();
});
