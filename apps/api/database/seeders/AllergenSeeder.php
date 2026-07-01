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
            ['code' => 'gluten', 'name' => 'Gluten', 'icon' => 'wheat'],
            ['code' => 'crustaceans', 'name' => 'Kabuklu Deniz Ürünleri', 'icon' => 'shrimp'],
            ['code' => 'eggs', 'name' => 'Yumurta', 'icon' => 'egg'],
            ['code' => 'fish', 'name' => 'Balık', 'icon' => 'fish'],
            ['code' => 'peanuts', 'name' => 'Yer Fıstığı', 'icon' => 'peanut'],
            ['code' => 'soybeans', 'name' => 'Soya', 'icon' => 'soy'],
            ['code' => 'milk', 'name' => 'Süt', 'icon' => 'milk'],
            ['code' => 'nuts', 'name' => 'Sert Kabuklu Yemişler', 'icon' => 'nut'],
            ['code' => 'celery', 'name' => 'Kereviz', 'icon' => 'celery'],
            ['code' => 'mustard', 'name' => 'Hardal', 'icon' => 'mustard'],
            ['code' => 'sesame', 'name' => 'Susam', 'icon' => 'sesame'],
            ['code' => 'sulphites', 'name' => 'Sülfitler', 'icon' => 'sulphite'],
            ['code' => 'lupin', 'name' => 'Acı Bakla', 'icon' => 'lupin'],
            ['code' => 'molluscs', 'name' => 'Yumuşakçalar', 'icon' => 'mollusc'],
        ];

        foreach ($allergens as $allergen) {
            Allergen::updateOrCreate(['code' => $allergen['code']], $allergen);
        }
    }
}
