<?php

namespace App\Enums;

/**
 * Panel/staff roles (docs/04 §4.3, docs/05 §5.1 users.role).
 *
 * Hierarchy for authorization:
 *   superadmin  — platform operator (no tenant); reaches tenants only via audited impersonation
 *   owner       — full control within the tenant
 *   manager     — operational management; oversees waiter + kitchen
 *   waiter      — floor operations
 *   kitchen     — KDS / prep
 *
 * waiter and kitchen are siblings: neither satisfies the other.
 */
enum Role: string
{
    case Superadmin = 'superadmin';
    case Owner = 'owner';
    case Manager = 'manager';
    case Waiter = 'waiter';
    case Kitchen = 'kitchen';

    /** Roles selectable when inviting tenant staff (superadmin excluded). */
    public static function tenantRoles(): array
    {
        return [self::Owner, self::Manager, self::Waiter, self::Kitchen];
    }

    public function label(): string
    {
        return match ($this) {
            self::Superadmin => 'Super Admin',
            self::Owner => 'Owner',
            self::Manager => 'Manager',
            self::Waiter => 'Waiter',
            self::Kitchen => 'Kitchen',
        };
    }

    /** Does this role satisfy the given required role (considering hierarchy)? */
    public function satisfies(string $required): bool
    {
        if ($this === self::Superadmin || $this === self::Owner) {
            return true;
        }

        $req = self::tryFrom($required);

        if ($req === null) {
            return false;
        }

        if ($this === $req) {
            return true;
        }

        // Manager oversees floor + kitchen operations.
        return $this === self::Manager
            && in_array($req, [self::Manager, self::Waiter, self::Kitchen], true);
    }

    /** @param  array<int,string>  $required */
    public function satisfiesAny(array $required): bool
    {
        foreach ($required as $role) {
            if ($this->satisfies($role)) {
                return true;
            }
        }

        return false;
    }
}
