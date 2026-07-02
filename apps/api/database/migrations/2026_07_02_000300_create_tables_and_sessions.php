<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * QR & table/area management (M3, docs/05 §5.4). Tables carry an unguessable,
 * unique qr_token; the public menu resolves tenant + table from it. Sessions
 * group an open tab across multiple order rounds.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dining_areas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 16)->default('table'); // table | room | sunbed | stand
            $table->timestamps();

            $table->index(['tenant_id', 'branch_id']);
        });

        Schema::create('tables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->foreignId('dining_area_id')->nullable()->constrained('dining_areas')->nullOnDelete();
            $table->string('code'); // "Masa 5" / "Oda 210" / "Şezlong 12"
            $table->string('qr_token', 64)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'branch_id', 'is_active']);
        });

        Schema::create('table_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('table_id')->constrained('tables')->cascadeOnDelete();
            $table->string('status', 16)->default('open'); // open | closed
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedSmallInteger('guest_count')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'table_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('table_sessions');
        Schema::dropIfExists('tables');
        Schema::dropIfExists('dining_areas');
    }
};
