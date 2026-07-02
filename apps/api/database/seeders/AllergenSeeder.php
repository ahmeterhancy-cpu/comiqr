<?php

namespace Database\Seeders;

use App\Models\Allergen;
use Illuminate\Database\Seeder;

/**
 * The 14 EU-regulated allergens (docs/03 §3.2). Global reference data.
 */
class AllergenSeeder extends Seeder
{
    public function run(): void
    {
        $allergens = [
            ['code' => 'gluten', 'name' => 'Gluten', 'icon' => '🌾'],
            ['code' => 'crustaceans', 'name' => 'Kabuklu Deniz Ürünleri', 'icon' => '🦐'],
            ['code' => 'eggs', 'name' => 'Yumurta', 'icon' => '🥚'],
            ['code' => 'fish', 'name' => 'Balık', 'icon' => '🐟'],
            ['code' => 'peanuts', 'name' => 'Yer Fıstığı', 'icon' => '🥜'],
            ['code' => 'soybeans', 'name' => 'Soya', 'icon' => '🫘'],
            ['code' => 'milk', 'name' => 'Süt', 'icon' => '🥛'],
            ['code' => 'nuts', 'name' => 'Sert Kabuklu Yemişler', 'icon' => '🌰'],
            ['code' => 'celery', 'name' => 'Kereviz', 'icon' => '🥬'],
            ['code' => 'mustard', 'name' => 'Hardal', 'icon' => '🟡'],
            ['code' => 'sesame', 'name' => 'Susam', 'icon' => '🥯'],
            ['code' => 'sulphites', 'name' => 'Sülfitler', 'icon' => '🍷'],
            ['code' => 'lupin', 'name' => 'Acı Bakla', 'icon' => '🌼'],
            ['code' => 'molluscs', 'name' => 'Yumuşakçalar', 'icon' => '🦪'],
        ];

        foreach ($allergens as $allergen) {
            Allergen::updateOrCreate(['code' => $allergen['code']], $allergen);
        }
    }
}
