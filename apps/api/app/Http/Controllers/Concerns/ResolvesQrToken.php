<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Table;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;

/**
 * Resolves a public request to a table + tenant from an unguessable qr_token and
 * activates the tenant context. Possession of the token is the authorisation for
 * the customer ordering surface (docs/04 §4.3/§4.9).
 */
trait ResolvesQrToken
{
    /** @return array{0: Table, 1: Tenant} */
    protected function resolveByToken(string $qrToken): array
    {
        $table = Table::withoutTenancy()
            ->where('qr_token', $qrToken)
            ->where('is_active', true)
            ->first();

        abort_if($table === null, 404, 'Not found.');

        $tenant = Tenant::find($table->tenant_id);
        abort_if($tenant === null || $tenant->status === 'suspended', 404, 'Not found.');

        app(TenantManager::class)->set($tenant);

        return [$table, $tenant];
    }
}
