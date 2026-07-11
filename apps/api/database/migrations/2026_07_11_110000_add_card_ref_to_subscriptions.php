<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Card-on-file for owner self-serve billing: the owner enters their card on the
 * billing page (pay3d → Tiko, never our server) and Tiko tokenises it. We keep
 * the token (card_ref) + a masked last4/brand to re-charge each period and to show
 * "kartınızı güncelleyin" when a charge fails.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->string('card_ref')->nullable()->after('gateway_ref');   // Tiko CardId
            $table->string('card_last4', 4)->nullable()->after('card_ref');
            $table->string('card_brand')->nullable()->after('card_last4');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn(['card_ref', 'card_last4', 'card_brand']);
        });
    }
};
