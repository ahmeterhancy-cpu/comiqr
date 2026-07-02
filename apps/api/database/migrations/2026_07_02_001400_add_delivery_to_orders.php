<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Package-service (marketplace) ordering (Faz 2, M20). An order is now typed:
 * dine_in (table QR), delivery (to an address) or takeaway (pickup). Delivery
 * captures a contact phone + address; dine-in leaves them null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('type', 16)->default('dine_in')->after('source'); // dine_in | delivery | takeaway
            $table->string('contact_phone', 32)->nullable()->after('note');
            $table->text('address')->nullable()->after('contact_phone');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['type', 'contact_phone', 'address']);
        });
    }
};
