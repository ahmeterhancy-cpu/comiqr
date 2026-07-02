<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A payment against an order (M5, docs/05 §5.5). Multiple payments per order
 * support bill splitting (docs/04 §4.6).
 */
class Payment extends Model
{
    /** @use HasFactory<\Database\Factories\PaymentFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'order_id', 'gateway', 'amount', 'tip_amount',
        'status', 'gateway_ref', 'split_meta_json', 'invoice_ref',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'tip_amount' => 'decimal:2',
            'split_meta_json' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function markPaid(?string $ref = null): void
    {
        $this->update(['status' => 'paid', 'gateway_ref' => $ref ?? $this->gateway_ref]);
    }
}
