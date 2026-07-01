<?php

namespace App\Models\Scopes;

use App\Support\Tenancy\TenantManager;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Global scope that constrains every query on a tenant-owned model to the
 * active tenant (docs/04 §4.2). Applied by {@see \App\Models\Concerns\BelongsToTenant}.
 *
 * When no tenant is active (central context) the scope is a no-op — such
 * contexts (onboarding, login, superadmin, jobs) must scope tenant access
 * explicitly. The `withoutTenancy()` / `forTenant()` macros exist for that.
 */
class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $manager = app(TenantManager::class);

        if ($manager->check()) {
            $builder->where(
                $model->getTable().'.'.$model->getTenantIdColumn(),
                $manager->id(),
            );
        }
    }

    public function extend(Builder $builder): void
    {
        // Escape hatch for central/superadmin queries: Model::withoutTenancy()->...
        $builder->macro('withoutTenancy', function (Builder $builder) {
            return $builder->withoutGlobalScope(static::class);
        });

        // Query an explicit tenant regardless of the active one:
        // Model::forTenant($id)->...
        $builder->macro('forTenant', function (Builder $builder, int|\App\Models\Tenant $tenant) {
            $model = $builder->getModel();
            $tenantId = $tenant instanceof \App\Models\Tenant ? $tenant->id : $tenant;

            return $builder
                ->withoutGlobalScope(static::class)
                ->where($model->getTable().'.'.$model->getTenantIdColumn(), $tenantId);
        });
    }
}
