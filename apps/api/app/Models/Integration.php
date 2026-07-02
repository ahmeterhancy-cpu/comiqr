<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * An outbound connector to an external system (Faz 2) — POS/ÖKC/ERP/delivery.
 * config_json holds the endpoint/credentials; delivery is handled by the
 * IntegrationAdapter resolved from {@see provider}.
 */
class Integration extends Model
{
    use BelongsToTenant;

    public const TYPES = ['pos', 'okc', 'erp', 'delivery'];

    protected $fillable = [
        'tenant_id', 'type', 'provider', 'name', 'config_json', 'is_active', 'last_synced_at',
    ];

    protected $attributes = ['is_active' => true];

    protected $hidden = ['config_json'];

    protected function casts(): array
    {
        return [
            'config_json' => 'array',
            'is_active' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }

    /** Types that should receive a push when an order is placed. */
    public const ORDER_TYPES = ['pos', 'erp', 'delivery'];
}
