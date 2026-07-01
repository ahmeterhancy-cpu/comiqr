<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Modifier group — a set of add-ons/options for products (M1, docs/05 §5.2).
 */
class ModifierGroup extends Model
{
    /** @use HasFactory<\Database\Factories\ModifierGroupFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = ['tenant_id', 'name', 'min_select', 'max_select', 'is_required'];

    protected function casts(): array
    {
        return [
            'min_select' => 'integer',
            'max_select' => 'integer',
            'is_required' => 'boolean',
        ];
    }

    public function modifiers(): HasMany
    {
        return $this->hasMany(Modifier::class)->orderBy('sort');
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_modifier_group')->withPivot('sort');
    }
}
