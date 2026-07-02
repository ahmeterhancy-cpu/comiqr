<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Customers + loyalty (Faz 2, M8, docs/05 §5.7). PII (phone/email) is encrypted
 * at rest (KVKK, docs/04 §4.9); a per-tenant phone_hash enables lookup without
 * decrypting. Points are earned on paid orders and redeemable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->text('phone')->nullable();        // encrypted
            $table->string('phone_hash', 64)->nullable(); // sha256(normalized) for lookup
            $table->string('name')->nullable();
            $table->text('email')->nullable();        // encrypted
            $table->string('locale', 5)->nullable();
            $table->jsonb('consent_json')->nullable();
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->unsignedInteger('total_orders')->default(0);
            $table->decimal('total_spend', 14, 2)->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'phone_hash']);
        });

        Schema::create('loyalty_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->integer('points_balance')->default(0);
            $table->integer('stamps_balance')->default(0);
            $table->string('tier', 16)->default('standard');
            $table->timestamps();

            $table->unique('customer_id');
        });

        Schema::create('loyalty_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loyalty_account_id')->constrained('loyalty_accounts')->cascadeOnDelete();
            $table->string('type', 8); // earn | redeem | adjust
            $table->integer('points');
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->jsonb('meta_json')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('table_session_id')
                ->constrained('customers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_id');
        });
        Schema::dropIfExists('loyalty_transactions');
        Schema::dropIfExists('loyalty_accounts');
        Schema::dropIfExists('customers');
    }
};
