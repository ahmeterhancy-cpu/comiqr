<?php

namespace App\Support\Tenancy;

use App\Models\Tenant;
use Closure;

/**
 * Holds the tenant for the current request/job lifecycle.
 *
 * Row-level multi-tenancy (docs/04 §4.2): once a tenant is set here, the
 * {@see \App\Models\Scopes\TenantScope} global scope filters every tenant-owned
 * model by `tenant_id`, and {@see \App\Models\Concerns\BelongsToTenant} auto-fills
 * `tenant_id` on insert. Central contexts (onboarding, login, superadmin, queue
 * bootstrap) run with no tenant set and must touch tenant data only explicitly.
 *
 * Registered as a singleton (`AppServiceProvider`) so a single instance is shared
 * across the request; also aliased in the container as `tenant`.
 */
class TenantManager
{
    protected ?Tenant $tenant = null;

    public function set(Tenant $tenant): static
    {
        $this->tenant = $tenant;

        return $this;
    }

    public function forget(): static
    {
        $this->tenant = null;

        return $this;
    }

    public function get(): ?Tenant
    {
        return $this->tenant;
    }

    public function id(): ?int
    {
        return $this->tenant?->id;
    }

    public function check(): bool
    {
        return $this->tenant !== null;
    }

    /**
     * Run a callback with $tenant as the active tenant, restoring the previous
     * tenant afterwards. Used by onboarding (seed the new tenant's rows) and by
     * superadmin impersonation.
     *
     * @template TReturn
     * @param  Closure():TReturn  $callback
     * @return TReturn
     */
    public function runAs(Tenant $tenant, Closure $callback): mixed
    {
        $previous = $this->tenant;
        $this->tenant = $tenant;

        try {
            return $callback();
        } finally {
            $this->tenant = $previous;
        }
    }
}
