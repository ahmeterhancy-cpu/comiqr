<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Payments (M5, docs/05 §5.5, §4.6). Tenant-scoped. Card data never touches us
 * (tokenised/redirect); we store only gateway references. Bill splitting = many
 * payments per order.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('gateway', 16); // cash | paytr | tiko
            $table->decimal('amount', 12, 2)->default(0);
            $table->decimal('tip_amount', 12, 2)->default(0);
            $table->string('status', 16)->default('initiated'); // initiated|paid|failed|refunded
            $table->string('gateway_ref')->nullable();
            $table->json('split_meta_json')->nullable();
            $table->string('invoice_ref')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'order_id', 'status']);
            $table->index('gateway_ref');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
