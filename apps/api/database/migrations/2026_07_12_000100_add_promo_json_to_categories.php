<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Category promotion: a percentage discount applied to every product in the
 * category. Stored as { enabled, percent, label } (mirrors settings_json.happy_hour).
 * Reflected in the customer menu prices and charged server-side per order line.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->json('promo_json')->nullable()->after('daypart_json');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('promo_json');
        });
    }
};
