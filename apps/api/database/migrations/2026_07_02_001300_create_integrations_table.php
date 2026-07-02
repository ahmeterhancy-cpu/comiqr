<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * External system integrations (Faz 2, docs/01 §1.4) — POS/ÖKC/ERP/delivery
 * connectors. Each row is one active outbound connector for a tenant; deliveries
 * fan out through the abstract IntegrationAdapter (default: generic webhook).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('type');                 // pos | okc | erp | delivery
            $table->string('provider');             // webhook | simpra | adisyo | yemeksepeti | ...
            $table->string('name');
            $table->jsonb('config_json')->nullable(); // { endpoint, secret, ... }
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integrations');
    }
};
