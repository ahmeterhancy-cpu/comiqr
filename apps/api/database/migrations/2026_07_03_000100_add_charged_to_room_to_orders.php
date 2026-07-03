<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hotel vertical (Faz 3): a room-service order can be deferred onto the room's
 * folio instead of paid on the spot. The front desk settles the folio at
 * check-out. Flagged orders stay `unpaid` until then; the flag is what the
 * folio view groups by. Restaurant/bar tenants never set it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('charged_to_room')->default(false)->after('type');
            $table->index(['tenant_id', 'charged_to_room', 'payment_status']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'charged_to_room', 'payment_status']);
            $table->dropColumn('charged_to_room');
        });
    }
};
