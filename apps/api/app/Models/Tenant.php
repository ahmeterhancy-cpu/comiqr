<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A business on the platform (docs/05 §5.1). Central model — resolved from
 * subdomain/custom-domain by the TenantResolver (docs/04 §4.2). NOT itself
 * tenant-scoped; it is the tenant.
 */
class Tenant extends Model
{
    /** @use HasFactory<\Database\Factories\TenantFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'slug', 'custom_domain', 'plan_id', 'status',
        'locale_default', 'currency', 'timezone', 'settings_json', 'trial_ends_at',
    ];

    protected function casts(): array
    {
        return [
            'settings_json' => 'array',
            'trial_ends_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function subscription(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'active' || $this->status === 'trialing';
    }
}
