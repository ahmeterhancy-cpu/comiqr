<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * DB-level guard: at most one OPEN shift per (tenant, branch) — race-safe backstop
 * to the app check in PosShiftController. A partial unique index only constrains
 * open rows (any number of closed shifts allowed); COALESCE treats a null branch
 * as 0 so branch-less opens can't duplicate either.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("CREATE UNIQUE INDEX shifts_one_open_per_branch ON shifts (tenant_id, COALESCE(branch_id, 0)) WHERE status = 'open'");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS shifts_one_open_per_branch');
    }
};
