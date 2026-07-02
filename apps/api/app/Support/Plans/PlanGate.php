<?php

namespace App\Support\Plans;

use App\Models\Tenant;

/**
 * Plan feature/limit gating (M12, docs/01 §1.6). Semantics:
 *  - A tenant with NO plan assigned is unrestricted (custom/enterprise/dev).
 *  - A tenant on a plan is allowed a feature only if its plan enables it
 *    (e.g. Free disables `ordering`).
 * Limits use -1 for "unlimited".
 */
class PlanGate
{
    public static function allows(Tenant $tenant, string $feature): bool
    {
        if ($tenant->plan === null) {
            return true;
        }

        return (bool) data_get($tenant->plan->features_json, $feature, false);
    }

    /** Numeric limit for a key, or null when unlimited / no plan. */
    public static function limit(Tenant $tenant, string $key): ?int
    {
        if ($tenant->plan === null) {
            return null;
        }

        $value = data_get($tenant->plan->limits_json, $key);
        if ($value === null || (int) $value === -1) {
            return null;
        }

        return (int) $value;
    }

    /** Would adding $adding to the current $count exceed the plan limit? */
    public static function withinLimit(Tenant $tenant, string $key, int $count, int $adding = 1): bool
    {
        $limit = self::limit($tenant, $key);

        return $limit === null || ($count + $adding) <= $limit;
    }
}
