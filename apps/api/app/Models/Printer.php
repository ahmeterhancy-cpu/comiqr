<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Database\Factories\PrinterFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A ticket printer at a station (Faz 4). Routing is by menu category — an empty
 * category list means "everything on the order prints here", which is what a
 * single-printer venue wants out of the box.
 */
class Printer extends Model
{
    /** @use HasFactory<PrinterFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    public const KINDS = ['kitchen', 'bar', 'cashier', 'label'];

    protected $fillable = [
        'tenant_id', 'branch_id', 'name', 'kind', 'target',
        'category_ids_json', 'copies', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'category_ids_json' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function jobs(): HasMany
    {
        return $this->hasMany(PrintJob::class);
    }

    /** Does this printer take items from the given category? */
    public function handlesCategory(?int $categoryId): bool
    {
        $ids = $this->category_ids_json;

        if (! is_array($ids) || $ids === []) {
            return true; // catch-all printer
        }

        return $categoryId !== null && in_array($categoryId, array_map('intval', $ids), true);
    }
}
