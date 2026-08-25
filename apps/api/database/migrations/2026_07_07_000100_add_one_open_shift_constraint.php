<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * DB-level guard: at most one OPEN shift per (tenant, branch) — race-safe backstop
 * to the app check in PosShiftController. Any number of CLOSED shifts is allowed;
 * a null branch counts as 0 so branch-less opens can't duplicate either.
 *
 * Iki surucu, iki ayri kurulum -- kismi indeks (WHERE'li indeks) MySQL'de YOK:
 *
 *   pgsql  kismi essiz indeks; yalnizca acik satirlari kisitlar.
 *   mysql  uretilmis kolon + essiz indeks. Kolon, satir acik degilken NULL olur
 *          ve MySQL essiz indekste NULL'lari catistirmaz; boylece kisit yalnizca
 *          acik satirlara uygulanmis olur. Ayni semantik.
 */
return new class extends Migration
{
    private const INDEX = 'shifts_one_open_per_branch';

    private const COLUMN = 'open_shift_key';

    public function up(): void
    {
        if ($this->isMySql()) {
            // Tek bir metin anahtari uretiliyor; MySQL cok kolonlu bir ifadeyi
            // dogrudan essiz kisit olarak indeksleyemiyor.
            //
            // VIRTUAL, STORED degil: STORED kolon eklemek tabloyu yeniden kurar
            // ve yabancı anahtari olan bir tabloda "1215 Cannot add foreign key
            // constraint" ile duser. VIRTUAL yerinde eklenir ve MySQL 8 sanal
            // kolonlar uzerinde essiz indekse izin verir.
            DB::statement(
                'ALTER TABLE shifts ADD COLUMN '.self::COLUMN.' VARCHAR(64) '
                ."GENERATED ALWAYS AS (CASE WHEN status = 'open' "
                ."THEN CONCAT(tenant_id, '-', COALESCE(branch_id, 0)) ELSE NULL END) VIRTUAL"
            );
            DB::statement('CREATE UNIQUE INDEX '.self::INDEX.' ON shifts ('.self::COLUMN.')');

            return;
        }

        DB::statement(
            'CREATE UNIQUE INDEX '.self::INDEX.' ON shifts (tenant_id, COALESCE(branch_id, 0)) '
            ."WHERE status = 'open'"
        );
    }

    public function down(): void
    {
        if ($this->isMySql()) {
            // Kolon dusunce ona bagli indeks de duser.
            if (Schema::hasColumn('shifts', self::COLUMN)) {
                DB::statement('ALTER TABLE shifts DROP COLUMN '.self::COLUMN);
            }

            return;
        }

        DB::statement('DROP INDEX IF EXISTS '.self::INDEX);
    }

    private function isMySql(): bool
    {
        return DB::connection()->getDriverName() === 'mysql';
    }
};
