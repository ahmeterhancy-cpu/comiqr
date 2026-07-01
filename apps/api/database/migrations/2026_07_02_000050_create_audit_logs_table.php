<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audit log (docs/04 §4.9, docs/05 §5.1). Captures superadmin + critical actions.
 * tenant_id nullable: platform-level (superadmin) events have no tenant.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');                       // e.g. tenant.registered, tenant.impersonated
            $table->string('subject_type')->nullable();     // morph type
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->jsonb('meta_json')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'action']);
            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
