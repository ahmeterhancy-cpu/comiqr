<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * COGS snapshot (Faz 4 — maliyet-kâr raporu). The recipe cost of a product moves
 * as ingredient prices change, so a report run months later must not re-price
 * old sales at today's cost. We freeze the per-unit recipe cost onto the order
 * line at sale time; null means "no recipe at the time" and the report falls
 * back to the product's current cost.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('unit_cost', 12, 2)->nullable()->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('unit_cost');
        });
    }
};
