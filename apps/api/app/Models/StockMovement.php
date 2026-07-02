<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single change to an ingredient's stock (Faz 2, M2/M18, docs/05 §5.3).
 */
class StockMovement extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'ingredient_id', 'order_item_id', 'qty_delta', 'reason', 'created_by', 'created_at',
    ];

    protected function casts(): array
    {
        return ['qty_delta' => 'float', 'created_at' => 'datetime'];
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }
}
