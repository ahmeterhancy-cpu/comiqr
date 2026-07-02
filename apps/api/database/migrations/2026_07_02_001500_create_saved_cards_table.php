<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Customer stored cards (Faz 2, M20) — Tiko tokenised cards for faster repeat
 * online payment. We keep only the gateway token (CardId) + alias/last4; no PAN.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('tiko_card_id');
            $table->string('alias')->nullable();
            $table->string('last4', 4)->nullable();
            $table->timestamps();

            $table->unique(['customer_id', 'tiko_card_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_cards');
    }
};
