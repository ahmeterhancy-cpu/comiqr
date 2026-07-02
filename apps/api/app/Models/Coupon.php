<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A discount coupon (Faz 2, M8, docs/05 §5.7).
 */
class Coupon extends Model
{
    /** @use HasFactory<\Database\Factories\CouponFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'code', 'type', 'value', 'conditions_json',
        'valid_from', 'valid_to', 'usage_limit', 'used_count', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'conditions_json' => 'array',
            'valid_from' => 'datetime',
            'valid_to' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /** Is the coupon usable right now? */
    public function isRedeemable(): bool
    {
        $now = now();

        return $this->is_active
            && ($this->valid_from === null || $this->valid_from <= $now)
            && ($this->valid_to === null || $this->valid_to >= $now)
            && ($this->usage_limit === null || $this->used_count < $this->usage_limit);
    }

    /** Discount amount for a given subtotal (respecting min_subtotal). */
    public function discountFor(float $subtotal): float
    {
        $min = (float) ($this->conditions_json['min_subtotal'] ?? 0);
        if ($subtotal < $min) {
            return 0.0;
        }

        $discount = match ($this->type) {
            'percent' => $subtotal * ((float) $this->value / 100),
            'amount' => (float) $this->value,
            default => 0.0,
        };

        return round(min($discount, $subtotal), 2);
    }
}
