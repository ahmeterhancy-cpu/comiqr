<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasTranslations;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Menu product (M1, docs/05 §5.2). Tenant-scoped. Links 1:1 to a recipe and a
 * derived nutrition summary (M2, docs/03).
 */
class Product extends Model
{
    /** @use HasFactory<\Database\Factories\ProductFactory> */
    use BelongsToTenant, HasFactory, HasTranslations, SoftDeletes;

    protected array $translatable = ['name', 'description'];

    protected $fillable = [
        'tenant_id', 'category_id', 'name', 'description', 'price',
        'image_paths_json', 'video_path', 'is_active', 'sort', 'prep_minutes',
        'calories_display', 'tags_json', 'external_pos_id',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'image_paths_json' => 'array',
            'tags_json' => 'array',
            'is_active' => 'boolean',
            'calories_display' => 'boolean',
        ];
    }

    public function translationModel(): string
    {
        return ProductTranslation::class;
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('sort');
    }

    public function modifierGroups(): BelongsToMany
    {
        return $this->belongsToMany(ModifierGroup::class, 'product_modifier_group')
            ->withPivot('sort')
            ->orderBy('product_modifier_group.sort');
    }

    public function recipe(): HasOne
    {
        return $this->hasOne(Recipe::class);
    }

    public function nutritionSummary(): HasOne
    {
        return $this->hasOne(NutritionSummary::class);
    }
}
