<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ingredients (M2, docs/03 §3.2, docs/05 §5.3). Tenant-scoped master cards:
 * nutrition per 100 g/ml, allergens (pivot), unit cost and diet flags — the
 * source data the nutrition engine derives everything from.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingredients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->string('unit', 8)->default('g'); // g | ml | adet
            $table->decimal('grams_per_unit', 10, 2)->nullable(); // required when unit = adet

            // Nutrition per 100 g/ml.
            $table->decimal('kcal', 10, 2)->default(0);
            $table->decimal('protein_g', 10, 2)->default(0);
            $table->decimal('carb_g', 10, 2)->default(0);
            $table->decimal('fat_g', 10, 2)->default(0);
            $table->decimal('saturated_fat_g', 10, 2)->default(0);
            $table->decimal('sugar_g', 10, 2)->default(0);
            $table->decimal('fiber_g', 10, 2)->default(0);
            $table->decimal('sodium_mg', 10, 2)->default(0);

            // Cost.
            $table->decimal('unit_cost', 12, 4)->default(0); // cost per cost_unit
            $table->string('cost_unit', 16)->default('kg');  // e.g. TL per kg/L/adet
            $table->decimal('waste_pct', 5, 2)->default(0);

            // Diet flags (drive derived product diet flags).
            $table->boolean('is_vegan')->default(false);
            $table->boolean('is_vegetarian')->default(false);
            $table->boolean('is_gluten_free')->default(false);

            // Optional stock (M2/V2).
            $table->decimal('stock_qty', 12, 2)->nullable();
            $table->decimal('low_stock_threshold', 12, 2)->nullable();

            $table->string('data_source', 16)->default('manual'); // manual|usda|tuber|ai_estimated
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'name']);
        });

        Schema::create('ingredient_allergen', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingredient_id')->constrained('ingredients')->cascadeOnDelete();
            $table->foreignId('allergen_id')->constrained('allergens')->cascadeOnDelete();
            $table->boolean('trace')->default(false); // "may contain traces of"
            $table->unique(['ingredient_id', 'allergen_id']);
        });

        // Now that ingredients exists, wire the modifier → ingredient link (M1).
        Schema::table('modifiers', function (Blueprint $table) {
            $table->foreign('ingredient_id')->references('id')->on('ingredients')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('modifiers', function (Blueprint $table) {
            $table->dropForeign(['ingredient_id']);
        });
        Schema::dropIfExists('ingredient_allergen');
        Schema::dropIfExists('ingredients');
    }
};
