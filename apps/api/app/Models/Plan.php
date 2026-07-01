<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * SaaS plan (docs/05 §5.1). Global reference — not tenant-scoped.
 */
class Plan extends Model
{
    /** @use HasFactory<\Database\Factories\PlanFactory> */
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'price_monthly', 'price_yearly', 'currency',
        'limits_json', 'features_json', 'sort', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price_monthly' => 'decimal:2',
            'price_yearly' => 'decimal:2',
            'limits_json' => 'array',
            'features_json' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function tenants(): HasMany
    {
        return $this->hasMany(Tenant::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function limit(string $key, mixed $default = null): mixed
    {
        return data_get($this->limits_json, $key, $default);
    }

    public function hasFeature(string $key): bool
    {
        return (bool) data_get($this->features_json, $key, false);
    }
}
