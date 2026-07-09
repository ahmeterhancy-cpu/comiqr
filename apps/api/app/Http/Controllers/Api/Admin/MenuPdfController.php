<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\Plans\PlanGate;
use App\Support\Tenancy\TenantManager;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Yazdırılabilir menü — sunucu tarafında dompdf ile tek-tık indirilebilir PDF
 * (baskıya hazır A4). Tenant, oturum açan kullanıcıdan gelir (tenant.user).
 * Tarayıcı-yazdırma önizlemesinden farkı: gerçek dosya indirir (dompdf-güvenli
 * tek-sütun tablo düzeni).
 */
class MenuPdfController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    public function download(Request $request): Response
    {
        $tenant = $this->tenants->get();
        $settings = $tenant->settings_json ?? [];
        app()->setLocale($request->query('locale', $tenant->locale_default ?? config('app.locale')));

        // Marka rengi yalnız white-label planında; aksi halde varsayılan lacivert.
        $whiteLabel = PlanGate::allows($tenant, 'white_label');
        $brand = $this->safeColor($whiteLabel ? ($settings['brand_color'] ?? null) : null) ?? '#14284a';

        $symbol = $this->currencySymbol($tenant->currency ?? 'TRY');
        $money = fn ($n) => number_format((float) $n, 2, ',', '.').' '.$symbol;

        $categories = Category::query()
            ->where('is_active', true)
            ->whereNull('parent_id')
            ->with([
                'translations',
                'products' => fn ($q) => $q->where('is_active', true)->orderBy('sort'),
                'products.translations',
                'products.variants',
            ])
            ->orderBy('sort')
            ->get()
            ->map(fn (Category $c) => [
                'name' => $c->name,
                'items' => $c->products->map(function ($p) use ($money) {
                    $hasVariants = $p->variants->isNotEmpty();

                    return [
                        'name' => $p->name,
                        'desc' => $p->description,
                        'age' => (bool) $p->age_restricted,
                        'price' => $hasVariants ? null : $money($p->price),
                        'variants' => $hasVariants
                            ? $p->variants->map(fn ($v) => $v->name.' '.$money((float) $p->price + (float) $v->price_delta))->implode('  ·  ')
                            : null,
                    ];
                })->all(),
            ])
            ->filter(fn ($c) => count($c['items']) > 0)
            ->values()
            ->all();

        $pdf = Pdf::loadView('menu-pdf', [
            'brand' => $brand,
            'venue' => [
                'name' => $tenant->name,
                'sub_title' => $settings['sub_title'] ?? null,
                'address' => $settings['address'] ?? null,
                'timing' => $settings['timing'] ?? null,
            ],
            'categories' => $categories,
        ])->setPaper('a4');

        return $pdf->download('menu-'.$tenant->slug.'.pdf');
    }

    private function currencySymbol(string $currency): string
    {
        return ['TRY' => '₺', 'USD' => '$', 'EUR' => '€', 'GBP' => '£'][$currency] ?? $currency;
    }

    private function safeColor(?string $c): ?string
    {
        $c = trim((string) $c);

        return preg_match('/^#[0-9a-fA-F]{3,8}$/', $c) ? $c : null;
    }
}
