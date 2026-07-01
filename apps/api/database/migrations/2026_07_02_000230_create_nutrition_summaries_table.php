<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Derived nutrition summary — 1:1 with product (M2, docs/03 §3.2, docs/05 §5.3).
 * Recomputed whenever the recipe/ingredients change (RecomputeNutrition job) so
 * the public menu reads a cache, never a live calculation (docs/03 §3.3).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nutrition_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('product_id')->unique()->constrained('products')->cascadeOnDelete();

            // Per portion.
            $table->decimal('per_portion_kcal', 10, 2)->default(0);
            $table->decimal('protein_g', 10, 2)->default(0);
            $table->decimal('carb_g', 10, 2)->default(0);
            $table->decimal('fat_g', 10, 2)->default(0);
            $table->decimal('saturated_fat_g', 10, 2)->default(0);
            $table->decimal('sugar_g', 10, 2)->default(0);
            $table->decimal('fiber_g', 10, 2)->default(0);
            $table->decimal('sodium_mg', 10, 2)->default(0);

            $table->jsonb('allergen_ids_json')->nullable();   // derived union
            $table->jsonb('diet_flags_json')->nullable();     // {vegan, vegetarian, gluten_free}

            // Cost / menu engineering.
            $table->decimal('cost_per_portion', 12, 2)->default(0);
            $table->decimal('suggested_price', 12, 2)->nullable();
            $table->decimal('margin_pct', 6, 2)->nullable();

            $table->timestamp('computed_at')->nullable();
            $table->boolean('is_stale')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nutrition_summaries');
    }
};
