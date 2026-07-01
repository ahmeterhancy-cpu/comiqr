<?php

namespace App\Jobs;

use App\Models\NutritionSummary;
use App\Models\Product;
use App\Models\Tenant;
use App\Support\Nutrition\NutritionCalculator;
use App\Support\Tenancy\TenantManager;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Recomputes a product's nutrition + cost summary whenever its recipe or an
 * ingredient changes (docs/03 §3.3). Runs on the queue and writes the derived
 * `nutrition_summaries` row so the public menu never computes live.
 *
 * Jobs carry no ambient tenant, so it re-establishes the tenant explicitly.
 */
class RecomputeNutrition implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $tenantId,
        public int $productId,
    ) {}

    public function handle(NutritionCalculator $calculator, TenantManager $tenants): void
    {
        $tenant = Tenant::find($this->tenantId);
        if (! $tenant) {
            return;
        }

        $tenants->runAs($tenant, function () use ($calculator, $tenant) {
            $product = Product::with('recipe.items.ingredient.allergens')->find($this->productId);
            if (! $product) {
                return;
            }

            $recipe = $product->recipe;
            if (! $recipe || $recipe->items->isEmpty()) {
                // Nothing to derive from — drop any stale summary.
                NutritionSummary::where('product_id', $product->id)->delete();

                return;
            }

            $data = $calculator->forRecipe($recipe, (float) $product->price);

            NutritionSummary::updateOrCreate(
                ['product_id' => $product->id],
                array_merge($data, [
                    'tenant_id' => $tenant->id,
                    'is_stale' => false,
                    'computed_at' => now(),
                ]),
            );
        });
    }
}
