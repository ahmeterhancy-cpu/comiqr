<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A grouping of tables/rooms/sunbeds/stands within a branch (M3, docs/05 §5.4).
 */
class DiningArea extends Model
{
    /** @use HasFactory<\Database\Factories\DiningAreaFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = ['tenant_id', 'branch_id', 'name', 'type'];

    public function tables(): HasMany
    {
        return $this->hasMany(Table::class);
    }
}
