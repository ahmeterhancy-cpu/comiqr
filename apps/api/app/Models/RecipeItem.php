<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single line of a recipe: an ingredient and its quantity for the full yield
 * (M2, docs/03 §3.2).
 */
class RecipeItem extends Model
{
    protected $fillable = ['recipe_id', 'ingredient_id', 'quantity', 'unit'];

    protected function casts(): array
    {
        return [
            'quantity' => 'float',
        ];
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function ingredient(): BelongsTo
    {
        return $this->belongsTo(Ingredient::class);
    }
}
