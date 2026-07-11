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

    /** Days of grace after a failed recurring charge before the account is restricted. */
    public const GRACE_DAYS = 4;

    protected $fillable = [
        'tenant_id', 'plan_id', 'status', 'billing_cycle', 'current_period_end', 'grace_ends_at', 'gateway_ref',
    ];

    protected function casts(): array
    {
        return [
            'current_period_end' => 'datetime',
            'grace_ends_at' => 'datetime',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /** A recurring charge couldn't be collected — go past_due and start the grace window. */
    public function markPaymentFailed(): void
    {
        $this->update([
            'status' => 'past_due',
            'grace_ends_at' => now()->addDays(self::GRACE_DAYS),
        ]);
    }

    /** A charge succeeded — back to active, grace cleared, period extended. */
    public function markPaid(?\DateTimeInterface $periodEnd = null): void
    {
        $this->update([
            'status' => 'active',
            'grace_ends_at' => null,
            'current_period_end' => $periodEnd ?? $this->current_period_end,
        ]);
    }

    /** Still inside the grace window after a failed payment? */
    public function inGrace(): bool
    {
        return $this->status === 'past_due' && $this->grace_ends_at !== null && $this->grace_ends_at->isFuture();
    }
}
