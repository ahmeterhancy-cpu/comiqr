<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Printer routing (Faz 4 — roadmap madde 4). A ticket has to land at the station
 * that makes it: hot food at the kitchen printer, drinks at the bar, the bill at
 * the till. Routing is by product category, mirroring how KDS stations already
 * split the menu (kds_stations.category_ids_json).
 *
 * We own the routing and the queue; putting ink on paper is the job of a small
 * local bridge on the venue's network, which polls for its printer's pending
 * jobs and acknowledges them. Nothing here talks to hardware directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->cascadeOnDelete();
            $table->string('name');                        // Mutfak, Bar, Kasa
            $table->string('kind', 16)->default('kitchen'); // kitchen|bar|cashier|label
            // Where the bridge should send it — ip:port, a share name, or a bridge id.
            $table->string('target')->nullable();
            // Which menu categories print here. Empty/null = everything on the order.
            $table->jsonb('category_ids_json')->nullable();
            $table->unsignedSmallInteger('copies')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'branch_id']);
        });

        Schema::create('print_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('printer_id')->constrained('printers')->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('type', 16)->default('order');   // order|addition|bill|test
            // The rendered ticket: header, lines, note. Kept as data so the bridge
            // (or a browser preview) decides how to lay it out.
            $table->jsonb('payload_json');
            $table->string('status', 16)->default('pending'); // pending|printed|failed
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('error')->nullable();
            $table->timestamp('printed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'printer_id', 'status']);
            $table->index(['tenant_id', 'status', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('print_jobs');
        Schema::dropIfExists('printers');
    }
};
