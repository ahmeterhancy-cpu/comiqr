<?php

namespace App\Models;

use App\Enums\Role;
use App\Models\Concerns\BelongsToTenant;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Panel/staff user (docs/05 §5.1). Belongs to a tenant, except superadmins
 * (tenant_id = null) — hence the tenant is optional here. The global tenant
 * scope still isolates staff listings once a tenant is active (docs/04 §4.2/§4.3).
 */
class User extends Authenticatable
{
    use BelongsToTenant, HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /** Superadmins legitimately have a null tenant_id. */
    protected bool $tenantOptional = true;

    protected $fillable = [
        'tenant_id', 'name', 'email', 'phone', 'password', 'role',
    ];

    protected $hidden = [
        'password', 'remember_token', 'two_factor_secret',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
        ];
    }

    public function isSuperadmin(): bool
    {
        return $this->role === Role::Superadmin;
    }

    public function hasRole(Role|string $role): bool
    {
        $role = $role instanceof Role ? $role : Role::tryFrom($role);

        return $this->role === $role;
    }
}
