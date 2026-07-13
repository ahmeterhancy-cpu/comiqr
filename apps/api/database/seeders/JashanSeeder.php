<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Branch;
use App\Models\Category;
use App\Models\DiningArea;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Jashan Indian Restaurant (Girne) — menu imported from
 * comiqr.com/girne/jashan-indian-restaurant (content + prices). Item photos use
 * emoji placeholders; swap for real photos later. Owner: jashan@comiqr.com / password.
 */
class JashanSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([PlanSeeder::class]);

        $tenant = Tenant::firstOrCreate(
            ['slug' => 'jashan-indian-restaurant'],
            [
                'name' => 'Jashan Indian Restaurant',
                'plan_id' => Plan::firstWhere('code', 'pro')?->id,
                'status' => 'active',
                'locale_default' => 'en',
                'currency' => 'TRY',
                'timezone' => 'Asia/Nicosia',
            ],
        );

        app(TenantManager::class)->runAs($tenant, function () use ($tenant) {
            User::firstOrCreate(
                ['email' => 'jashan@comiqr.com'],
                [
                    'tenant_id' => $tenant->id,
                    'name' => 'Jashan Owner',
                    'password' => Hash::make('password'),
                    'role' => Role::Owner,
                    'email_verified_at' => now(),
                ],
            );

            $tenant->update(['settings_json' => array_merge($tenant->settings_json ?? [], [
                'logo' => $this->emojiImg('jashan/logo.svg', '🍛', '#b45309', 240),
                'cover' => $this->emojiImg('jashan/cover.svg', '🍛', '#7c2d12', 1200, 480),
                'theme' => 'modern',
                'sub_title' => 'Authentic Indian Cuisine · Girne',
                'timing' => '12:00 - 23:00',
                'description' => 'Authentic Indian curries, biryani, tandoori and seafood in Girne. Dine in or takeaway.',
                'address' => 'Girne / KKTC',
                'phone' => '0542 850 95 00',
                'email' => 'malikturk@yahoo.com',
                'allow_takeaway' => true,
                'allow_delivery' => true,
                'delivery_charge' => 50,
            ])]);

            $branch = Branch::firstOrCreate(['tenant_id' => $tenant->id, 'name' => 'Merkez'], ['is_active' => true, 'timezone' => 'Asia/Nicosia']);
            $salon = DiningArea::firstOrCreate(['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'name' => 'Salon'], ['type' => 'table']);
            foreach (['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6'] as $code) {
                Table::updateOrCreate(
                    ['tenant_id' => $tenant->id, 'branch_id' => $branch->id, 'code' => $code],
                    ['is_active' => true, 'dining_area_id' => $salon->id],
                );
            }

            // Protein variants — [name, price_delta, is_default]
            $seafood = [['Fish', 0, true], ['Prawn', 0, false], ['King Prawn', 50, false]];
            $meat = [['Chicken', 0, true], ['Beef', 210, false], ['Lamb', 230, false]];

            // [category => [ [name, price, emoji, desc?, variants?] ]]
            $catCover = [
                'Biryani' => ['🍛', '#b45309'],
                'Starters' => ['🥟', '#7c3aed'],
                'Chicken Dishes' => ['🍗', '#b91c1c'],
                'Lamb Dishes' => ['🥩', '#991b1b'],
                'Beef Dishes' => ['🥩', '#7f1d1d'],
                'Vegetable Dishes' => ['🥦', '#15803d'],
                'Seafood Dishes' => ['🦐', '#0369a1'],
                "Chef's Special" => ['⭐', '#a16207'],
                'Desserts' => ['🍮', '#be185d'],
            ];

            $menu = [
                'Biryani' => [
                    ['Chicken Biryani', 770, '🍛'],
                    ['Lamb Biryani', 1000, '🍛'],
                    ['Beef Biryani', 980, '🍛'],
                    ['Vegetable Biryani', 580, '🍛'],
                    ['Prawn Biryani', 950, '🍤'],
                    ['King Prawn Biryani', 1000, '🦐'],
                ],
                'Starters' => [
                    ['Poppadoms', 90, '🫓'],
                    ['Onion Bhajee', 300, '🧅'],
                    ['Pekoras', 300, '🥔'],
                    ['Mushroom Bhajee', 350, '🍄'],
                    ['Prawn Bhajee', 450, '🦐'],
                    ['Samosas', 300, '🥟'],
                    ['Mix Starter', 350, '🍢'],
                    ['Garlic Mushroom', 400, '🍄'],
                ],
                'Chicken Dishes' => [
                    ['Chicken Curry', 750, '🍛'],
                    ['Chicken Jhalfrazi', 750, '🌶️'],
                    ['Chicken Balti', 750, '🍲'],
                    ['Chicken Tikka Masala', 770, '🍗'],
                    ['Butter Chicken', 770, '🧈'],
                    ['Chicken Saag', 750, '🥬'],
                    ['Chicken Korma', 770, '🥥'],
                    ['Chicken Dhansak', 750, '🍲'],
                    ['Chicken Kotmiri', 750, '🌿'],
                    ['Chicken Dopiaza', 750, '🧅'],
                    ['Chicken Roghan Josh', 750, '🍛'],
                    ['Chicken Tikka', 800, '🍗'],
                    ['Chicken Malai', 800, '🍗'],
                    ['Chicken Rashmi', 800, '🍗'],
                    ['Tandori Mixed', 850, '🔥'],
                    ['Chicken Bhuna', 750, '🍛'],
                ],
                'Lamb Dishes' => [
                    ['Lamb Curry', 1000, '🥩'],
                    ['Lamb Jhalfrazi', 1000, '🌶️'],
                    ['Lamb Balti', 1000, '🍲'],
                    ['Lamb Korma', 1000, '🥥'],
                    ['Lamb Saag', 1000, '🥬'],
                    ['Lamb Bhuna', 1000, '🍛'],
                    ['Lamb Dhansak', 1000, '🍲'],
                    ['Lamb Kotmiri', 1000, '🌿'],
                    ['Lamb Dopiaza', 1000, '🧅'],
                    ['Lamb Roghan Josh', 1000, '🍛'],
                ],
                'Beef Dishes' => [
                    ['Beef Curry', 980, '🥩'],
                    ['Beef Jhalfrazi', 980, '🌶️'],
                    ['Beef Balti', 980, '🍲'],
                    ['Beef Korma', 980, '🥥'],
                    ['Beef Saag', 980, '🥬'],
                    ['Beef Bhuna', 980, '🍛'],
                    ['Beef Dhansak', 980, '🍲'],
                    ['Beef Kotmiri', 980, '🌿'],
                    ['Beef Dopiaza', 980, '🧅'],
                    ['Beef Roghan Josh', 980, '🍛'],
                ],
                'Vegetable Dishes' => [
                    ['Saag Alo', 580, '🥬'],
                    ['Nawabi Koftay', 580, '🧆'],
                    ['Bombay Potatoes', 580, '🥔'],
                    ['Tarka Dal', 580, '🍲'],
                    ['Paneer Balti', 580, '🧀'],
                    ['Vegetable Curry', 580, '🥦'],
                    ['Sag Paneer', 580, '🧀'],
                    ['Subzi Bahar', 580, '🥗'],
                    ['Mushroom Masala', 530, '🍄'],
                    ['Vegetable Korma', 580, '🥥'],
                    ['Alo Gobhi', 580, '🥔'],
                ],
                'Seafood Dishes' => [
                    ['Seafood Jhalfrazi', 950, '🌶️', '', $seafood],
                    ['Seafood Balti', 950, '🍲', '', $seafood],
                    ['Seafood Curry', 950, '🍛', '', $seafood],
                    ['Seafood Korma', 950, '🥥', '', $seafood],
                    ['Seafood Bhuna', 950, '🍛', '', $seafood],
                    ['King Prawn Rubean', 1000, '🦐'],
                ],
                "Chef's Special" => [
                    ['Prawn Puri', 450, '🦐'],
                    ['Prawn Bhajee', 450, '🦐'],
                    ['Chicken Pakora', 400, '🍗'],
                    ['Handi', 770, '🍲', '', $meat],
                    ['Ginger', 770, '🫚', '', $meat],
                    ['Naurettin', 770, '🍛', '', $meat],
                    ['Tavva', 770, '🍳', '', $meat],
                    ['Patiha', 770, '🍲', '', $meat],
                ],
                'Desserts' => [
                    ['Gulab Jamun', 350, '🍮'],
                    ['Gager Ka Hawa', 350, '🥕', 'Traditional Indian sweet with carrots, milk, sugar, nuts'],
                ],
            ];

            $sort = 0;
            foreach ($menu as $catName => $dishes) {
                [$emoji, $bg] = $catCover[$catName] ?? ['🍽️', '#334155'];
                $cover = $this->emojiImg('jashan/cat-'.Str::slug($catName).'.svg', $emoji, $bg, 500, 400);
                $cat = Category::updateOrCreate(
                    ['tenant_id' => $tenant->id, 'name' => $catName],
                    ['sort' => $sort++, 'is_active' => true, 'image_path' => $cover],
                );
                foreach ($dishes as $d) {
                    $product = Product::updateOrCreate(
                        ['category_id' => $cat->id, 'name' => $d[0]],
                        [
                            'price' => $d[1],
                            'description' => $d[3] ?? '',
                            'is_active' => true,
                            'calories_display' => false,
                            'image_paths_json' => [$this->emojiImg('jashan/'.Str::slug($d[0]).'.svg', $d[2], '#eef1f6')],
                        ],
                    );
                    // Optional protein variants.
                    if (! empty($d[4])) {
                        $product->variants()->delete();
                        foreach ($d[4] as $vi => [$vname, $delta, $isDefault]) {
                            $product->variants()->create([
                                'name' => $vname,
                                'price_delta' => $delta,
                                'is_default' => $isDefault,
                                'sort' => $vi,
                            ]);
                        }
                    }
                }
            }
        });
    }

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
