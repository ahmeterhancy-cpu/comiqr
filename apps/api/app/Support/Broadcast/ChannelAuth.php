<?php

namespace App\Support\Broadcast;

use App\Models\Branch;
use App\Models\User;

/**
 * Authorization for the live per-branch WebSocket feeds (M6/M10). Only staff of
 * the branch's tenant may join. Extracted from routes/channels.php so the tenant
 * boundary is unit-testable without the broadcaster/HTTP layer.
 */
class ChannelAuth
{
    public const FEEDS = ['kds', 'orders', 'waiter'];

    public static function canJoinBranch(User $user, int $branchId, string $feed): bool
    {
        if (! in_array($feed, self::FEEDS, true)) {
            return false;
        }

        // Branch lookup bypasses the tenant scope; the tenant match IS the boundary.
        $tenantId = Branch::withoutTenancy()->whereKey($branchId)->value('tenant_id');

        return $tenantId !== null && (int) $user->tenant_id === (int) $tenantId;
    }
}
