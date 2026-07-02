<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
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
    /**
     * GET /superadmin/overview — platform KPIs. MRR is the sum of the monthly
     * price of the plan on every active/trialing tenant (docs/01 §1.6). Counts
     * span all tenants (no tenant scope active in the superadmin context).
     */
    public function overview(): JsonResponse
    {
        $byStatus = Tenant::query()->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');

        $mrr = (float) Tenant::query()
            ->whereIn('status', ['active', 'trialing'])
            ->join('plans', 'plans.id', '=', 'tenants.plan_id')
            ->sum('plans.price_monthly');

        return response()->json(['data' => [
            'tenants' => [
                'total' => (int) $byStatus->sum(),
                'active' => (int) ($byStatus['active'] ?? 0),
                'trialing' => (int) ($byStatus['trialing'] ?? 0),
                'suspended' => (int) ($byStatus['suspended'] ?? 0),
            ],
            'orders' => Order::count(),
            'revenue' => round((float) Payment::where('status', 'paid')->sum('amount'), 2),
            'mrr' => round($mrr, 2),
            'currency' => Plan::query()->where('is_active', true)->value('currency') ?? 'TRY',
        ]]);
    }

    /** GET /superadmin/plans — every plan with pricing, gates and tenant count. */
    public function plans(): JsonResponse
    {
        $plans = Plan::query()->withCount('tenants')->orderBy('sort')->get()->map(fn (Plan $p) => [
            'id' => $p->id,
            'code' => $p->code,
            'name' => $p->name,
            'price_monthly' => $p->price_monthly,
            'price_yearly' => $p->price_yearly,
            'currency' => $p->currency,
            'features' => $p->features_json,
            'limits' => $p->limits_json,
            'is_active' => $p->is_active,
            'tenants' => $p->tenants_count,
        ]);

        return response()->json(['data' => $plans]);
    }

    /** PATCH /superadmin/plans/{id} — edit pricing, gates and availability. */
    public function updatePlan(Request $request, string $id): JsonResponse
    {
        $plan = Plan::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'price_monthly' => ['sometimes', 'numeric', 'min:0'],
            'price_yearly' => ['sometimes', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'is_active' => ['sometimes', 'boolean'],
            'features_json' => ['sometimes', 'array'],
            'limits_json' => ['sometimes', 'array'],
        ]);

        $plan->update($data);

        AuditLog::create([
            'tenant_id' => null,
            'user_id' => $request->user()->id,
            'action' => 'superadmin.plan_updated',
            'subject_type' => Plan::class,
            'subject_id' => $plan->id,
            'meta_json' => $data,
            'ip' => $request->ip(),
        ]);

        return response()->json(['data' => $plan->fresh()]);
    }

    /** GET /superadmin/tenants/{id} — drill-down: users, subscription, usage. */
    public function tenantDetail(string $id): JsonResponse
    {
        $tenant = Tenant::with('plan:id,code,name,price_monthly')
            ->withCount(['users', 'branches'])
            ->findOrFail($id);

        $users = User::where('tenant_id', $tenant->id)
            ->get(['id', 'name', 'email', 'role', 'last_login_at'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role?->value,
                'last_login_at' => $u->last_login_at,
            ]);

        $subscription = Subscription::where('tenant_id', $tenant->id)->with('plan:id,name')->latest()->first();

        return response()->json(['data' => [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'slug' => $tenant->slug,
            'status' => $tenant->status,
            'plan' => $tenant->plan?->name,
            'currency' => $tenant->currency,
            'trial_ends_at' => $tenant->trial_ends_at,
            'created_at' => $tenant->created_at,
            'counts' => [
                'users' => $tenant->users_count,
                'branches' => $tenant->branches_count,
                'orders' => Order::where('tenant_id', $tenant->id)->count(),
            ],
            'last_order_at' => Order::where('tenant_id', $tenant->id)->max('placed_at'),
            'subscription' => $subscription ? [
                'plan' => $subscription->plan?->name,
                'status' => $subscription->status,
                'billing_cycle' => $subscription->billing_cycle,
                'current_period_end' => $subscription->current_period_end,
            ] : null,
            'users' => $users,
        ]]);
    }

    /** GET /superadmin/users?q= — global user lookup across tenants (support). */
    public function userSearch(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (strlen($q) < 2) {
            return response()->json(['data' => []]);
        }

        $users = User::query()
            ->where(fn ($w) => $w->where('email', 'ilike', "%{$q}%")->orWhere('name', 'ilike', "%{$q}%"))
            ->with('tenant:id,name,slug')
            ->orderBy('name')
            ->limit(50)
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role?->value,
                'tenant' => $u->tenant?->name,
                'tenant_slug' => $u->tenant?->slug,
                'last_login_at' => $u->last_login_at,
            ]);

        return response()->json(['data' => $users]);
    }

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
