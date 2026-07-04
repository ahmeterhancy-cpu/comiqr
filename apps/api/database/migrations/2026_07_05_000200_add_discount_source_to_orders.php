<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Track where an order's discount came from (Faz 3 — ultra POS). A cashier's
 * manual POS discount must not be silently overwritten by the automatic
 * happy-hour recompute when more items are added to the tab.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('discount_source', 12)->nullable()->after('discount_total'); // manual | happy_hour | coupon
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('discount_source');
        });
    }
};
