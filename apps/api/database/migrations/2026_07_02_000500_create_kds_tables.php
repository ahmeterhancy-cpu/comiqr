<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * KDS stations + 86 list (M6, docs/05 §5.6). Stations route items by category;
 * an 86'd product is instantly hidden from the public menu (docs/06 §6.7).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kds_stations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('name'); // Sıcak | Soğuk | Bar | Tatlı
            $table->jsonb('category_ids_json')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'branch_id']);
        });

        Schema::create('eighty_six_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('until')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'product_id']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreign('kds_station_id')->references('id')->on('kds_stations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['kds_station_id']);
        });
        Schema::dropIfExists('eighty_six_items');
        Schema::dropIfExists('kds_stations');
    }
};
