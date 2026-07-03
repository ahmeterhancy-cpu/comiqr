<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A customer review of an order (Faz 3). Tenant-scoped; one per order. Only
 * `published` reviews count toward the venue's reputation and are shown publicly.
 */
class Review extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'branch_id', 'order_id', 'customer_id', 'rating', 'comment', 'reply', 'status',
    ];

    protected function casts(): array
    {
        return ['rating' => 'integer'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
