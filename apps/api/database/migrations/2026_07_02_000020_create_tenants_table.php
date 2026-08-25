<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tenants — the businesses (docs/05 §5.1). Central table; resolved from
 * subdomain (`slug`) or `custom_domain` by the TenantResolver (docs/04 §4.2).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();                 // subdomain: {slug}.comiqr.com
            $table->string('custom_domain')->nullable()->unique();
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->string('status')->default('active');      // active | suspended | trialing
            $table->string('locale_default', 5)->default('tr');
            $table->string('currency', 3)->default('EUR');
            $table->string('timezone')->default('Asia/Nicosia');
            $table->json('settings_json')->nullable();        // branding, feature toggles
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
