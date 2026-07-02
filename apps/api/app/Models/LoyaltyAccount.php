<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A customer's loyalty account (Faz 2, M8, docs/05 §5.7).
 */
class LoyaltyAccount extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'customer_id', 'points_balance', 'stamps_balance', 'tier'];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(LoyaltyTransaction::class);
    }
}
