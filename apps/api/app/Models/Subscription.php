<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tenant subscription (docs/05 §5.1). Tenant-scoped.
 */
class Subscription extends Model
{
    /** @use HasFactory<\Database\Factories\SubscriptionFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'plan_id', 'status', 'billing_cycle', 'current_period_end', 'gateway_ref',
    ];

    protected function casts(): array
    {
        return [
            'current_period_end' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
