<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\DiningArea;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Table;
use App\Models\TableSession;
use App\Models\Tenant;
use App\Models\User;
use App\Services\OrderService;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

/**
 * A demo HOTEL venue (Faz 3 vertical) so the room-service + "charge to room"
 * folio flow can be seen end-to-end. Rooms are tables in a room-type dining
 * area; one room already has an open folio. Idempotent.
 * Owner login: otel@comiqr.com / password · subdomain: demo-otel
 */
class DemoHotelSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([PlanSeeder::class]);

        $tenant = Tenant::firstOrCreate(
            ['slug' => 'demo-otel'],
            [
                'name' => 'Deniz Kızı Otel',
                'plan_id' => Plan::firstWhere('code', 'business')?->id ?? Plan::firstWhere('code', 'pro')?->id,
                'status' => 'active',
                'locale_default' => 'tr',
                'currency' => 'TRY',
                'timezone' => 'Asia/Nicosia',
            ],
        );

        app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
            User::firstOrCreate(
                ['email' => 'otel@comiqr.com'],
                [
                    'tenant_id' => $tenant->id,
                    'name' => 'Otel Yönetimi',
                    'password' => Hash::make('password'),
                    'role' => Role::Owner,
                    'email_verified_at' => now(),
                ],
            );

            $tenant->update(['settings_json' => array_merge($tenant->settings_json ?? [], [
                'vertical' => 'hotel',
                'theme' => 'modern',
                'sub_title' => 'Oda Servisi',
                'timing' => '24 saat',
                'description' => 'Odanızın konforunda taze oda servisi. QR ile sipariş verin, dilerseniz oda hesabınıza yansıtın.',
                'address' => 'Sahil Yolu No:1, Girne / KKTC',
                'logo' => $this->placeholder('demo-otel/logo.svg', 'DK', '#1e5f74', 240, 240),
                'cover' => $this->placeholder('demo-otel/cover.svg', 'Deniz Kızı Otel', '#14495a', 1200, 480),
            ])]);

            $branch = Branch::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => 'Merkez'],
                ['is_active' => true, 'timezone' => 'Asia/Nicosia'],
            );

            $rooms = DiningArea::firstOrCreate(
                ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'name' => 'Odalar'],
                ['type' => 'room'],
            );
            $rooms->update(['type' => 'room']);

            $roomTables = collect(['101', '102', '103'])->map(fn ($code) => Table::firstOrCreate(
                ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'dining_area_id' => $rooms->id, 'code' => $code],
                ['is_active' => true],
            ));

            $cat = Category::updateOrCreate(
                ['tenant_id' => $tenant->id, 'name' => 'Oda Servisi'],
                ['sort' => 1, 'is_active' => true],
            );

            $kahvalti = $this->product($cat, 'Serpme Kahvaltı', 450, 'Kahvalti', '#e8a33d');
            $sandvic = $this->product($cat, 'Club Sandviç', 280, 'Sandvic', '#c96f3a');
            $suyu = $this->product($cat, 'Taze Portakal Suyu', 120, 'Portakal', '#e88a1a');

            // Leave room 101 with an open folio so the front-desk view isn't empty.
            $room101 = $roomTables->firstWhere('code', '101');
            $session = TableSession::firstOrCreate(
                ['table_id' => $room101->id, 'status' => 'open'],
                ['opened_at' => now()],
            );

            $alreadyCharged = Order::where('table_session_id', $session->id)->where('charged_to_room', true)->exists();
            if (! $alreadyCharged) {
                $order = app(OrderService::class)->place($room101, $session, [
                    ['product_id' => $kahvalti->id, 'quantity' => 1],
                    ['product_id' => $suyu->id, 'quantity' => 2],
                ]);
                $order->update(['charged_to_room' => true]);
            }

            // Pool sunbeds — the folio also works for beach-style spots (şezlong).
            $sunbeds = DiningArea::firstOrCreate(
                ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'name' => 'Havuz Şezlongları'],
                ['type' => 'sunbed'],
            );
            $sunbeds->update(['type' => 'sunbed']);

            $sunbedTables = collect(['Ş-1', 'Ş-2'])->map(fn ($code) => Table::firstOrCreate(
                ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'dining_area_id' => $sunbeds->id, 'code' => $code],
                ['is_active' => true],
            ));

            $s1 = $sunbedTables->firstWhere('code', 'Ş-1');
            $sSession = TableSession::firstOrCreate(['table_id' => $s1->id, 'status' => 'open'], ['opened_at' => now()]);
            if (! Order::where('table_session_id', $sSession->id)->where('charged_to_room', true)->exists()) {
                $so = app(OrderService::class)->place($s1, $sSession, [
                    ['product_id' => $suyu->id, 'quantity' => 2],
                ]);
                $so->update(['charged_to_room' => true]);
            }
        });
    }

    private function product(Category $category, string $name, float $price, string $label, string $bg): Product
    {
        $product = Product::updateOrCreate(
            ['category_id' => $category->id, 'name' => $name],
            ['price' => $price, 'is_active' => true, 'calories_display' => false],
        );

        $product->update(['image_paths_json' => [$this->placeholder('demo-otel/p-'.$label.'.svg', $name, $bg)]]);

        return $product;
    }

    /** Write a simple labelled SVG to the public disk and return its media URL. */
    private function placeholder(string $path, string $label, string $bg, int $w = 800, int $h = 600): string
    {
        $font = max(18, (int) ($w / max(6, mb_strlen($label) * 0.7)));
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'.$w.'" height="'.$h.'" viewBox="0 0 '.$w.' '.$h.'">'
            .'<rect width="100%" height="100%" fill="'.$bg.'"/>'
            .'<text x="50%" y="50%" font-family="Georgia, serif" font-size="'.$font.'" fill="#ffffff" '
            .'text-anchor="middle" dominant-baseline="middle">'.htmlspecialchars($label, ENT_QUOTES).'</text></svg>';

        Storage::disk('public')->put($path, $svg);

        return url('/v1/media/'.$path);
    }
}
