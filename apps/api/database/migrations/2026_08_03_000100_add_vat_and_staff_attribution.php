<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Faz 4 — Rapor Kokpiti groundwork.
 *
 * VAT: menu prices are VAT-INCLUSIVE (the guest pays the shelf price), so the
 * rate here only decides how that price is split for reporting — it never
 * changes what is charged. `products.vat_rate` is nullable and falls back to the
 * tenant default in settings_json.vat_rate.
 *
 * Staff: orders carried no operator, only a `source`. POS/waiter orders now
 * record who rang them up, which is what makes a per-staff report possible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('vat_rate', 5, 2)->nullable()->after('price');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('source')
                ->constrained('users')->nullOnDelete();
        });

        Schema::table('order_items', function (Blueprint $table) {
            // Frozen at sale time, like unit_cost — a later rate change must not
            // rewrite the tax history of sales already made.
            $table->decimal('vat_rate', 5, 2)->nullable()->after('unit_cost');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->index(['tenant_id', 'created_by']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'created_by']);
            $table->dropConstrainedForeignId('created_by');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('vat_rate');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('vat_rate');
        });
    }
};
