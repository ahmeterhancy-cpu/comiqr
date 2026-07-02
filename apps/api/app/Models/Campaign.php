<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A marketing campaign (Faz 2, M8). Draft until sent; delivery fans out over the
 * abstract CampaignChannel to the resolved audience (docs/05 §5.7).
 */
class Campaign extends Model
{
    use BelongsToTenant;

    public const CHANNELS = ['sms', 'whatsapp', 'email', 'push'];

    public const AUDIENCES = ['all', 'min_points'];

    protected $fillable = [
        'tenant_id', 'name', 'channel', 'subject', 'body',
        'audience', 'min_points', 'status', 'recipient_count', 'sent_count',
        'created_by', 'sent_at',
    ];

    protected $attributes = [
        'status' => 'draft',
        'recipient_count' => 0,
        'sent_count' => 0,
    ];

    protected function casts(): array
    {
        return [
            'min_points' => 'integer',
            'recipient_count' => 'integer',
            'sent_count' => 'integer',
            'sent_at' => 'datetime',
        ];
    }

    public function isSent(): bool
    {
        return $this->status === 'sent';
    }

    /** E-mail reaches customers by address; the rest reach them by phone. */
    public function usesEmail(): bool
    {
        return $this->channel === 'email';
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
