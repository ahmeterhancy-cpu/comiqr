<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Platform superadmin (M12, docs/06 §6.11). Operates across tenants (no tenant
 * scope). Impersonation is audited.
 */
class SuperadminController extends Controller
{
    /** GET /superadmin/tenants */
    public function tenants(): JsonResponse
    {
        $tenants = Tenant::query()
            ->with('plan:id,code,name')
            ->withCount(['users', 'branches'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (Tenant $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'status' => $t->status,
                'plan' => $t->plan?->name,
                'plan_id' => $t->plan_id,
                'users' => $t->users_count,
                'branches' => $t->branches_count,
                'trial_ends_at' => $t->trial_ends_at,
                'created_at' => $t->created_at,
            ]);

        return response()->json(['data' => $tenants]);
    }

    /** PATCH /superadmin/tenants/{id} — change status/plan. */
    public function updateTenant(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['active', 'trialing', 'suspended'])],
            'plan_id' => ['sometimes', Rule::exists('plans', 'id')],
        ]);
        $tenant->update($data);

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'superadmin.tenant_updated',
            'subject_type' => Tenant::class,
            'subject_id' => $tenant->id,
            'meta_json' => $data,
            'ip' => $request->ip(),
        ]);

        return response()->json(['data' => $tenant->fresh('plan')]);
    }

    /** POST /superadmin/tenants/{id}/impersonate — act as the tenant's owner. */
    public function impersonate(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $owner = User::withoutTenancy()
            ->where('tenant_id', $tenant->id)
            ->where('role', Role::Owner->value)
            ->first();

        abort_if($owner === null, 404, 'Tenant has no owner to impersonate.');

        $token = $owner->createToken('impersonation', ['impersonated'])->plainTextToken;

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'superadmin.impersonated',
            'subject_type' => User::class,
            'subject_id' => $owner->id,
            'meta_json' => ['tenant' => $tenant->slug, 'by' => $request->user()->email],
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'data' => [
                'token' => $token,
                'tenant' => ['id' => $tenant->id, 'name' => $tenant->name, 'slug' => $tenant->slug],
                'user' => ['id' => $owner->id, 'name' => $owner->name, 'email' => $owner->email, 'role' => 'owner'],
                'impersonated' => true,
            ],
        ]);
    }

    /** GET /superadmin/audit-logs */
    public function auditLogs(): JsonResponse
    {
        $logs = AuditLog::query()
            ->with(['tenant:id,name,slug', 'user:id,name,email'])
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (AuditLog $l) => [
                'id' => $l->id,
                'action' => $l->action,
                'tenant' => $l->tenant?->name,
                'user' => $l->user?->email,
                'meta' => $l->meta_json,
                'ip' => $l->ip,
                'created_at' => $l->created_at,
            ]);

        return response()->json(['data' => $logs]);
    }
}
