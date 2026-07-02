<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Orders + order items (M4, docs/05 §5.5). Tenant-scoped. Money is server
 * authoritative — the client never sends prices. Item status drives the KDS
 * (M6); order status/payment_status drive the tab lifecycle (docs/04 §4.5).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('table_session_id')->nullable()->constrained('table_sessions')->nullOnDelete();
            $table->string('source', 16)->default('qr'); // qr | waiter | preorder | kiosk
            $table->string('status', 16)->default('pending'); // pending|accepted|preparing|ready|served|cancelled
            $table->string('payment_status', 16)->default('unpaid'); // unpaid|partially_paid|paid|refunded
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('tip_total', 12, 2)->default(0);
            $table->decimal('tax_total', 12, 2)->default(0);
            $table->decimal('grand_total', 12, 2)->default(0);
            $table->text('note')->nullable();
            $table->timestamp('placed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'branch_id', 'status', 'placed_at']);
            $table->index(['table_session_id']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->jsonb('modifiers_json')->nullable(); // [{id,name,price_delta}]
            $table->decimal('line_total', 12, 2)->default(0);
            $table->string('status', 16)->default('pending'); // pending|preparing|ready|served|cancelled
            $table->foreignId('kds_station_id')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
