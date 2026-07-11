<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Grace period for failed recurring payments: when a monthly/yearly charge can't
 * be collected, the subscription goes `past_due` and gets +N days (grace_ends_at)
 * to settle before the account is restricted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->timestamp('grace_ends_at')->nullable()->after('current_period_end');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('grace_ends_at');
        });
    }
};
