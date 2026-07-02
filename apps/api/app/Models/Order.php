<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A customer order (M4, docs/05 §5.5). Tenant-scoped; money is server-computed.
 */
class Order extends Model
{
    /** @use HasFactory<\Database\Factories\OrderFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'branch_id', 'table_session_id', 'source', 'status', 'payment_status',
        'subtotal', 'discount_total', 'tip_total', 'tax_total', 'grand_total', 'note', 'placed_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'tip_total' => 'decimal:2',
            'tax_total' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'placed_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function tableSession(): BelongsTo
    {
        return $this->belongsTo(TableSession::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /** Recompute money from the current items (server authoritative). */
    public function recalculateTotals(): void
    {
        $subtotal = (float) $this->items()->sum('line_total');
        $this->subtotal = $subtotal;
        $this->grand_total = $subtotal - (float) $this->discount_total + (float) $this->tip_total + (float) $this->tax_total;
        $this->save();
    }

    /**
     * Derive the order status from its item statuses (docs/04 §4.5). Cancelled
     * items are ignored; an all-cancelled order becomes cancelled.
     */
    public function refreshStatusFromItems(): void
    {
        $statuses = $this->items()->pluck('status');
        if ($statuses->isEmpty()) {
            return;
        }

        $active = $statuses->reject(fn ($s) => $s === 'cancelled');

        $status = match (true) {
            $active->isEmpty() => 'cancelled',
            $active->every(fn ($s) => $s === 'served') => 'served',
            $active->every(fn ($s) => in_array($s, ['ready', 'served'], true)) => 'ready',
            $active->contains(fn ($s) => in_array($s, ['preparing', 'ready', 'served'], true)) => 'preparing',
            default => 'pending',
        };

        if ($status !== $this->status) {
            $this->update(['status' => $status]);
        }
    }
}
