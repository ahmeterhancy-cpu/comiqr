<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Menu view events (M9, docs/05 §5.8) — scan/impression analytics + heatmap.
 * High-volume table (aggregate/partition later); for MVP a simple insert.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menu_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('table_session_id')->nullable();
            $table->string('locale', 5)->nullable();
            $table->timestamp('viewed_at')->useCurrent();

            $table->index(['tenant_id', 'product_id', 'viewed_at']);
            $table->index(['tenant_id', 'branch_id', 'viewed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_views');
    }
};
