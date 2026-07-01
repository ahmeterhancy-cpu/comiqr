<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A tenant's physical location (docs/05 §5.1). Tenant-scoped.
 */
class Branch extends Model
{
    /** @use HasFactory<\Database\Factories\BranchFactory> */
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'name', 'address', 'phone', 'lat', 'lng',
        'timezone', 'is_active', 'settings_json',
    ];

    protected function casts(): array
    {
        return [
            'lat' => 'decimal:7',
            'lng' => 'decimal:7',
            'is_active' => 'boolean',
            'settings_json' => 'array',
        ];
    }
}
