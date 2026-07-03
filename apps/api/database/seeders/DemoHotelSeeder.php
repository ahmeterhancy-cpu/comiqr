<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\DiningArea;
use App\Models\NutritionSummary;
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
use Illuminate\Support\Str;

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
                'logo' => $this->emojiImg('demo-otel/logo.svg', '🌊', '#14495a', 240),
                'cover' => $this->emojiImg('demo-otel/cover.svg', '🛏️', '#14284a', 1200, 480),
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

            // [name, price, emoji, description, kcal, vegetarian]
            $menu = [
                'Kahvaltı' => [
                    ['Serpme Kahvaltı', 450, '🍳', 'Zengin Kıbrıs kahvaltısı: hellim, zeytin, reçeller ve sıcak ekmek.', 720, false],
                    ['Menemen', 220, '🍅', 'Domates, biber ve yumurta ile köy usulü.', 380, true],
                    ['Sahanda Omlet', 180, '🍳', 'Peynirli ya da sebzeli sahanda omlet.', 320, true],
                ],
                'Sıcaklar' => [
                    ['Club Sandviç', 280, '🥪', 'Tavuk, domates, marul ve patates kızartması ile.', 640, false],
                    ['Cheeseburger', 320, '🍔', '180gr köfte, cheddar ve ev yapımı sos.', 780, false],
                    ['Izgara Tavuk', 300, '🍗', 'Marine tavuk göğsü, mevsim sebzeleri ile.', 520, false],
                    ['Penne Arrabbiata', 260, '🍝', 'Acılı domates soslu penne.', 560, true],
                    ['Sezar Salata', 240, '🥗', 'Marul, ızgara tavuk, parmesan ve kraker.', 420, false],
                ],
                'Tatlı & İçecek' => [
                    ['Cheesecake', 180, '🍰', 'Frambuazlı New York usulü cheesecake.', 450, true],
                    ['Meyve Tabağı', 150, '🍓', 'Mevsim meyveleri tabağı.', 160, true],
                    ['Taze Portakal Suyu', 120, '🍊', 'Günlük sıkma portakal suyu.', 120, true],
                    ['Kola', 90, '🥤', 'Soğuk kutu kola.', 140, true],
                    ['Su', 40, '💧', '0.5L doğal kaynak suyu.', 0, true],
                    ['Kahve', 110, '☕', 'Espresso, Americano veya Latte.', 15, true],
                ],
            ];

            $products = [];
            $sort = 1;
            foreach ($menu as $catName => $dishes) {
                $c = Category::updateOrCreate(['tenant_id' => $tenant->id, 'name' => $catName], ['sort' => $sort++, 'is_active' => true]);
                foreach ($dishes as $d) {
                    $products[$d[0]] = $this->dish($c, $d[0], $d[1], $d[2], $d[3], $d[4], $d[5]);
                }
            }

            $kahvalti = $products['Serpme Kahvaltı'];
            $suyu = $products['Taze Portakal Suyu'];

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

    private function dish(Category $cat, string $name, float $price, string $emoji, string $desc, int $kcal, bool $veg): Product
    {
        $product = Product::updateOrCreate(
            ['category_id' => $cat->id, 'name' => $name],
            [
                'price' => $price,
                'description' => $desc,
                'is_active' => true,
                'calories_display' => $kcal > 0,
                'image_paths_json' => [$this->emojiImg('demo-otel/'.Str::slug($name).'.svg', $emoji, '#eef1f6')],
            ],
        );

        NutritionSummary::updateOrCreate(['product_id' => $product->id], [
            'per_portion_kcal' => $kcal,
            'protein_g' => max(1, round($kcal * 0.05)),
            'carb_g' => max(1, round($kcal * 0.11)),
            'fat_g' => max(1, round($kcal * 0.04)),
            'saturated_fat_g' => max(0, round($kcal * 0.015)),
            'sugar_g' => 5,
            'fiber_g' => 2,
            'sodium_mg' => 400,
            'allergen_ids_json' => ['contains' => [], 'traces' => []],
            'diet_flags_json' => ['vegan' => false, 'vegetarian' => $veg, 'gluten_free' => false],
            'is_stale' => false,
            'computed_at' => now(),
        ]);

        return $product;
    }

    /** A clean emoji-on-tint square, served from the public disk. */
    private function emojiImg(string $path, string $emoji, string $bg, int $w = 400, int $h = 0): string
    {
        $h = $h ?: $w;
        $size = (int) ($h * 0.5);
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'.$w.'" height="'.$h.'" viewBox="0 0 '.$w.' '.$h.'">'
            .'<rect width="100%" height="100%" fill="'.$bg.'"/>'
            .'<text x="50%" y="50%" font-size="'.$size.'" text-anchor="middle" dominant-baseline="central">'.$emoji.'</text></svg>';

        Storage::disk('public')->put($path, $svg);

        return url('/v1/media/'.$path);
    }
}
