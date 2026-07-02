<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A menu impression (M9, docs/05 §5.8). Used for scan counts + product heatmap.
 */
class MenuView extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = ['tenant_id', 'branch_id', 'product_id', 'table_session_id', 'locale', 'viewed_at'];

    protected function casts(): array
    {
        return ['viewed_at' => 'datetime'];
    }
}
