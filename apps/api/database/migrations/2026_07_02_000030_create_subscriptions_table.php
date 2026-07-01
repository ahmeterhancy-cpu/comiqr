<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tenant subscriptions (docs/05 §5.1). One active subscription per tenant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->restrictOnDelete();
            $table->string('status')->default('active'); // active | past_due | canceled | trialing
            $table->string('billing_cycle')->default('monthly'); // monthly | yearly
            $table->timestamp('current_period_end')->nullable();
            $table->string('gateway_ref')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
