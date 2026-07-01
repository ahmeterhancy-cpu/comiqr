<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single modifier option (M1). May link to an ingredient so its selection can
 * adjust nutrition/cost (docs/03 §3.3, V2).
 */
class Modifier extends Model
{
    protected $fillable = ['modifier_group_id', 'name', 'price_delta', 'ingredient_id', 'sort'];

    protected function casts(): array
    {
        return [
            'price_delta' => 'decimal:2',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(ModifierGroup::class, 'modifier_group_id');
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }
}
