<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Allergen reference (docs/03 §3.2). Global (not tenant-scoped).
 */
class Allergen extends Model
{
    protected $fillable = ['code', 'name', 'icon'];

    public function ingredients(): BelongsToMany
    {
        return $this->belongsToMany(Ingredient::class, 'ingredient_allergen')->withPivot('trace');
    }
}
