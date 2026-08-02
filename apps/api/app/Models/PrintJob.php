<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One ticket waiting to be printed (Faz 4). The payload is data, not ESC-POS
 * bytes: the local bridge — or the browser preview — decides the layout, so the
 * same job can be re-rendered for a different paper width without a reprint.
 */
class PrintJob extends Model
{
    use BelongsToTenant;

    public const TYPES = ['order', 'addition', 'bill', 'test'];

    protected $fillable = [
        'tenant_id', 'printer_id', 'order_id', 'type',
        'payload_json', 'status', 'attempts', 'error', 'printed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'printed_at' => 'datetime',
        ];
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
