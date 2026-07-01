<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Audit trail (docs/04 §4.9). Plain model (NOT globally tenant-scoped) because
 * platform-level superadmin events have a null tenant and are queried across
 * tenants from the superadmin panel. Tenant-facing reads must filter explicitly.
 */
class AuditLog extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'action', 'subject_type', 'subject_id', 'meta_json', 'ip',
    ];

    protected function casts(): array
    {
        return [
            'meta_json' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
