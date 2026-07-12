<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Owner self-serve staff (sub-user) management. The owner/manager creates and
 * manages users inside their own tenant — never the owner account or superadmins,
 * and only the staff roles (manager/waiter/kitchen) may be assigned.
 * Queries are tenant-scoped by the `tenant.user` middleware.
 */
class StaffController extends Controller
{
    /** Roles an owner/manager may assign to staff (never owner/superadmin). */
    private const ASSIGNABLE = ['manager', 'waiter', 'kitchen', 'cashier'];

    public function __construct(protected TenantManager $tenants) {}

    /** GET /staff — the tenant's owner + staff users (owner first). */
    public function index(): JsonResponse
    {
        $users = User::query()
            ->whereIn('role', array_merge(['owner'], self::ASSIGNABLE))
            ->orderByRaw("(role = 'owner') desc")
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $users->map(fn (User $u) => $this->present($u))->values()]);
    }

    /** POST /staff — add a staff user to the owner's tenant. */
    public function store(Request $request): JsonResponse
    {
        $tenant = $this->tenants->get();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:40'],
            'password' => ['required', 'string', 'min:8', 'max:255'],
            'role' => ['required', Rule::in(self::ASSIGNABLE)],
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'], // 'hashed' cast hashes on save
            'role' => $data['role'],
            'is_active' => true,
        ]);

        $this->audit($request, $user, 'staff.created', ['email' => $user->email, 'role' => $user->role?->value]);

        return response()->json(['data' => $this->present($user)], 201);
    }

    /** PATCH /staff/{id} — rename, change role, block/unblock or reset password. */
    public function update(Request $request, string $id): JsonResponse
    {
        $user = $this->findStaff($request, $id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'role' => ['sometimes', Rule::in(self::ASSIGNABLE)],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'string', 'min:8', 'max:255'],
        ]);

        foreach (['name', 'phone', 'role', 'is_active', 'password'] as $field) {
            if (array_key_exists($field, $data)) {
                $user->{$field} = $data[$field];
            }
        }
        $user->save();

        // Blocking or a password change must end any active sessions.
        if ((array_key_exists('is_active', $data) && ! $data['is_active']) || array_key_exists('password', $data)) {
            $user->tokens()->delete();
        }

        $this->audit($request, $user, 'staff.updated', ['changed' => array_keys($data)]);

        return response()->json(['data' => $this->present($user)]);
    }

    /** DELETE /staff/{id} — remove a staff user and revoke their tokens. */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $this->findStaff($request, $id);
        $user->tokens()->delete();
        $user->delete();

        $this->audit($request, $user, 'staff.deleted', ['email' => $user->email]);

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** Resolve a staff member in the current tenant; never the owner, self or a superadmin. */
    private function findStaff(Request $request, string $id): User
    {
        $user = User::query()->findOrFail($id); // tenant-scoped by middleware
        abort_if($user->role === Role::Owner, 403, 'İşletme sahibi hesabı buradan düzenlenemez.');
        abort_if($user->role === Role::Superadmin, 403, 'Bu hesap düzenlenemez.');
        abort_if($user->id === $request->user()->id, 403, 'Kendi hesabınızı buradan düzenleyemezsiniz.');

        return $user;
    }

    private function present(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'phone' => $u->phone,
            'role' => $u->role?->value,
            'role_label' => $u->role?->label(),
            'is_active' => (bool) $u->is_active,
            'is_owner' => $u->role === Role::Owner,
        ];
    }

    private function audit(Request $request, User $user, string $action, array $meta): void
    {
        AuditLog::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $request->user()->id,
            'action' => $action,
            'subject_type' => User::class,
            'subject_id' => $user->id,
            'meta_json' => $meta + ['by' => $request->user()->email],
            'ip' => $request->ip(),
        ]);
    }
}
