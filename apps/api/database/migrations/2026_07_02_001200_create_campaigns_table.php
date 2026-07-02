<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marketing campaigns (Faz 2, M8, docs/05 §5.7). A draft targets a customer
 * audience over one channel; sending fans out through the abstract
 * CampaignChannel (SMS/WhatsApp/e-mail/push) and records the delivery count.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->string('channel');                     // sms | whatsapp | email | push
            $table->string('subject')->nullable();         // e-mail subject
            $table->text('body');
            $table->string('audience')->default('all');    // all | min_points
            $table->unsignedInteger('min_points')->nullable();
            $table->string('status')->default('draft');    // draft | sent
            $table->unsignedInteger('recipient_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaigns');
    }
};
