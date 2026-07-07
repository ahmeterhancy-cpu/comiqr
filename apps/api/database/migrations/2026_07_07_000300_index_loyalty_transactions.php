<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A7: loyalty_transactions had zero indexes, yet the hot payment path does an
 * idempotency lookup by (loyalty_account_id, order_id, type) on every paid order.
 * Add the composite index so that check stays O(log n) as transactions grow.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loyalty_transactions', function (Blueprint $table) {
            $table->index(['loyalty_account_id', 'order_id'], 'loyalty_tx_account_order_idx');
        });
    }

    public function down(): void
    {
        Schema::table('loyalty_transactions', function (Blueprint $table) {
            $table->dropIndex('loyalty_tx_account_order_idx');
        });
    }
};
