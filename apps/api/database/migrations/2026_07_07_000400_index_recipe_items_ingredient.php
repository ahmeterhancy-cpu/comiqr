<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * C: recipe_items.ingredient_id is a FK but was unindexed (only recipe_id was),
 * so the reverse lookup "which recipes use this ingredient" (stock deduction /
 * 86-ing on low stock) did a full scan. Add the missing index.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recipe_items', function (Blueprint $table) {
            $table->index('ingredient_id');
        });
    }

    public function down(): void
    {
        Schema::table('recipe_items', function (Blueprint $table) {
            $table->dropIndex(['ingredient_id']);
        });
    }
};
