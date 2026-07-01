<?php

namespace App\Models\Concerns;

use App\Models\Scopes\TenantScope;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

/**
 * Applied to every tenant-owned model (docs/04 §4.2, docs/05).
 *
 *  - Adds the {@see TenantScope} global scope so reads/updates/deletes are
 *    automatically filtered by the active tenant.
 *  - Auto-fills `tenant_id` on insert from the active tenant. Inserting a
 *    tenant-owned row with no active tenant and no explicit `tenant_id` is a
 *    programming error and throws, so tenant data can never be written
 *    unscoped by accident.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope);

        static::creating(function ($model): void {
            $column = $model->getTenantIdColumn();

            if (! empty($model->{$column})) {
                return; // explicit tenant_id (onboarding, seeding, superadmin)
            }

            $tenantId = app(TenantManager::class)->id();

            if ($tenantId === null) {
                // Models where a null tenant is legitimate (e.g. superadmin users)
                // opt in via isTenantOptional(); everything else is a hard error so
                // tenant rows can never be written unscoped by accident.
                if ($model->isTenantOptional()) {
                    return;
                }

                throw new RuntimeException(sprintf(
                    'Cannot create %s without an active tenant. Set a tenant (TenantManager::set/runAs) or pass %s explicitly.',
                    static::class,
                    $column,
                ));
            }

            $model->{$column} = $tenantId;
        });
    }

    public function getTenantIdColumn(): string
    {
        return 'tenant_id';
    }

    /**
     * When true, rows may be created with a null tenant_id (used for the
     * superadmin user). The global scope still filters by the active tenant
     * when one is set.
     */
    public function isTenantOptional(): bool
    {
        return property_exists($this, 'tenantOptional') ? (bool) $this->tenantOptional : false;
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
