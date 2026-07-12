<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasTranslations;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Menu category (M1, docs/05 §5.2). Tenant-scoped, self-referencing tree.
 */
class Category extends Model
{
    /** @use HasFactory<\Database\Factories\CategoryFactory> */
    use BelongsToTenant, HasFactory, HasTranslations, SoftDeletes;

    protected array $translatable = ['name'];

    protected $fillable = [
        'tenant_id', 'branch_id', 'parent_id', 'name', 'sort', 'is_active', 'image_path', 'daypart_json', 'promo_json',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'daypart_json' => 'array',
            'promo_json' => 'array',
        ];
    }

    /** Active promo discount percent for this category (0 when off). */
    public function promoPercent(): float
    {
        $p = $this->promo_json ?? [];
        $pct = (float) ($p['percent'] ?? 0);

        return ! empty($p['enabled']) && $pct > 0 ? min(95.0, $pct) : 0.0;
    }

    public function translationModel(): string
    {
        return CategoryTranslation::class;
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class)->orderBy('sort');
    }
}
