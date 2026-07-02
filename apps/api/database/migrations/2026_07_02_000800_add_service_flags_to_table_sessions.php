<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Persist service-call flags so the waiter board/notifications survive a reload
 * even if a Reverb message was missed (M10, docs/06 §6.8).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('table_sessions', function (Blueprint $table) {
            $table->timestamp('waiter_called_at')->nullable();
            $table->timestamp('bill_requested_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('table_sessions', function (Blueprint $table) {
            $table->dropColumn(['waiter_called_at', 'bill_requested_at']);
        });
    }
};
