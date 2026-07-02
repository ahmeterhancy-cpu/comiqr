<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An open tab at a table across multiple order rounds (M3, docs/05 §5.4).
 */
class TableSession extends Model
{
    /** @use HasFactory<\Database\Factories\TableSessionFactory> */
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'tenant_id', 'table_id', 'status', 'opened_at', 'closed_at', 'guest_count',
        'waiter_called_at', 'bill_requested_at',
    ];

    protected function casts(): array
    {
        return [
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'waiter_called_at' => 'datetime',
            'bill_requested_at' => 'datetime',
        ];
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class);
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }
}
