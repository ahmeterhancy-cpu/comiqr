<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A6: menu_views.table_session_id was a bare foreignId with no FK, so deleting a
 * table_session orphaned analytics rows (skewing heatmap joins). Null out any
 * existing orphans, then add the same null-on-delete constraint every sibling
 * column already uses.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('UPDATE menu_views SET table_session_id = NULL WHERE table_session_id IS NOT NULL AND table_session_id NOT IN (SELECT id FROM table_sessions)');

        Schema::table('menu_views', function (Blueprint $table) {
            $table->foreign('table_session_id')->references('id')->on('table_sessions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('menu_views', function (Blueprint $table) {
            $table->dropForeign(['table_session_id']);
        });
    }
};
