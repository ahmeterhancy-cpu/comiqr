<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Allergen;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Payments\TikoGateway;
use App\Support\Restaurant\RestaurantSettings;
use Illuminate\Database\Eloquent\Builder;
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
            'users_total' => User::count(),
            'customers_total' => Customer::count(),
            'orders' => Order::count(),
            'revenue' => round((float) Payment::where('status', 'paid')->sum('amount'), 2),
            'mrr' => round($mrr, 2),
            'currency' => Plan::query()->where('is_active', true)->value('currency') ?? 'TRY',
            'recent_restaurants' => Tenant::query()->latest('id')->limit(5)
                ->get(['id', 'name', 'slug', 'status', 'created_at'])
                ->map(fn (Tenant $t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'slug' => $t->slug,
                    'status' => $t->status,
                    'created_at' => $t->created_at,
                ]),
            'recent_users' => User::query()->with('tenant:id,name')->latest('id')->limit(5)->get()
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'tenant' => $u->tenant?->name,
                    'created_at' => $u->created_at,
                ]),
            'restaurants_series' => $this->dailySeries(Tenant::query(), 'created_at'),
            'users_series' => $this->dailySeries(User::query(), 'created_at'),
        ]]);
    }

    /**
     * A daily count for the last $days, zero-filled (for the dashboard charts).
     *
     * @return array<int,array{date:string,count:int}>
     */
    private function dailySeries(Builder $query, string $column, int $days = 7): array
    {
        $from = now()->subDays($days - 1)->startOfDay();

        $rows = $query
            ->where($column, '>=', $from)
            ->selectRaw("to_char({$column}, 'YYYY-MM-DD') as d, count(*) as c")
            ->groupBy('d')
            ->pluck('c', 'd');

        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $date = now()->subDays($days - 1 - $i)->format('Y-m-d');
            $series[] = ['date' => $date, 'count' => (int) ($rows[$date] ?? 0)];
        }

        return $series;
    }

    /** GET /superadmin/transactions — recent payments across the platform. */
    public function transactions(): JsonResponse
    {
        $payments = Payment::query()->with('tenant:id,name,slug')->latest('id')->limit(100)->get()
            ->map(fn (Payment $p) => [
                'id' => $p->id,
                'tenant' => $p->tenant?->name,
                'gateway' => $p->gateway,
                'amount' => $p->amount,
                'tip' => $p->tip_amount,
                'status' => $p->status,
                'created_at' => $p->created_at,
            ]);

        return response()->json(['data' => $payments]);
    }

    /** GET /superadmin/allergens — global allergen reference (EU 14 + custom). */
    public function allergens(): JsonResponse
    {
        return response()->json(['data' => Allergen::orderBy('id')->get(['id', 'code', 'name', 'icon'])]);
    }

    public function storeAllergen(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:40', Rule::unique('allergens', 'code')],
            'name' => ['required', 'string', 'max:80'],
            'icon' => ['nullable', 'string', 'max:16'],
        ]);

        return response()->json(['data' => Allergen::create($data)], 201);
    }

    public function updateAllergen(Request $request, string $id): JsonResponse
    {
        $allergen = Allergen::findOrFail($id);
        $allergen->update($request->validate([
            'code' => ['sometimes', 'string', 'max:40', Rule::unique('allergens', 'code')->ignore($allergen->id)],
            'name' => ['sometimes', 'string', 'max:80'],
            'icon' => ['nullable', 'string', 'max:16'],
        ]));

        return response()->json(['data' => $allergen]);
    }

    public function deleteAllergen(string $id): JsonResponse
    {
        Allergen::findOrFail($id)->delete();

        return response()->json(['data' => ['deleted' => true]]);
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
            'settings' => $tenant->settings_json ?? [],
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
            ->get();

        // Owner name per tenant (first Owner user), for the list column.
        $owners = User::query()
            ->whereIn('tenant_id', $tenants->pluck('id'))
            ->where('role', Role::Owner->value)
            ->orderBy('id')
            ->get(['id', 'tenant_id', 'name'])
            ->groupBy('tenant_id')
            ->map(fn ($group) => $group->first()->name);

        $data = $tenants->map(fn (Tenant $t) => [
            'id' => $t->id,
            'name' => $t->name,
            'slug' => $t->slug,
            'status' => $t->status,
            'plan' => $t->plan?->name,
            'plan_id' => $t->plan_id,
            'owner_name' => $owners[$t->id] ?? null,
            'address' => $t->settings_json['address'] ?? null,
            'users' => $t->users_count,
            'branches' => $t->branches_count,
            'trial_ends_at' => $t->trial_ends_at,
            'created_at' => $t->created_at,
        ]);

        return response()->json(['data' => $data]);
    }

    /**
     * POST /superadmin/tenants/{id}/subscription — start Tiko recurring billing
     * for a tenant's plan (SaaS subscription). Tiko SMS-links the owner to
     * authorise the mandate; we store the recurring id as pending until then.
     */
    public function startSubscription(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $data = $request->validate([
            'plan_id' => ['required', Rule::exists('plans', 'id')],
            'billing_cycle' => ['nullable', Rule::in(['monthly', 'yearly'])],
        ]);

        $plan = Plan::findOrFail($data['plan_id']);
        $cycle = $data['billing_cycle'] ?? 'monthly';
        $amount = (float) ($cycle === 'yearly' ? $plan->price_yearly : $plan->price_monthly);
        abort_if($amount <= 0, 422, 'Bu plan için tekrarlı tahsil edilecek tutar yok (fiyat 0).');

        $owner = User::query()->where('tenant_id', $tenant->id)->where('role', Role::Owner->value)->first();
        abort_if($owner === null || empty($owner->phone), 422, 'İşletme sahibinin telefon numarası yok — tekrarlı ödeme başlatılamaz.');

        $tiko = new TikoGateway((array) config('payments.gateways.tiko'));
        $result = $tiko->createRecurring([
            'customer_name' => $owner->name,
            'customer_phone' => $owner->phone,
            'amount' => $amount,
            'currency' => $plan->currency,
            'first_collection_date' => now()->addDay()->format('Y-m-d\TH:i:s'),
            'frequency' => $cycle === 'yearly' ? 'Yearly' : 'Monthly',
            'end_condition' => 'Never',
            'plan_name' => $plan->name,
            'message_template' => 'ComiQR aboneliğiniz için: {{Link}}',
        ]);

        abort_if((string) ($result['Status'] ?? '') !== '200', 422, 'Tiko tekrarlı ödeme oluşturulamadı.');

        $recurringId = (string) ($result['Result']['Id'] ?? '');

        $subscription = Subscription::updateOrCreate(
            ['tenant_id' => $tenant->id],
            ['plan_id' => $plan->id, 'status' => 'pending_authorization', 'billing_cycle' => $cycle, 'gateway_ref' => $recurringId],
        );
        $tenant->update(['plan_id' => $plan->id]);

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'superadmin.subscription_started',
            'subject_type' => Subscription::class,
            'subject_id' => $subscription->id,
            'meta_json' => ['plan' => $plan->code, 'cycle' => $cycle, 'amount' => $amount, 'tiko_id' => $recurringId],
            'ip' => $request->ip(),
        ]);

        return response()->json(['data' => [
            'subscription' => [
                'plan' => $plan->name,
                'status' => $subscription->status,
                'billing_cycle' => $subscription->billing_cycle,
                'gateway_ref' => $subscription->gateway_ref,
            ],
            'tiko' => $result['Result'] ?? null,
        ]]);
    }

    /**
     * PATCH /superadmin/tenants/{id}/restaurant — manage a tenant's restaurant
     * profile/settings (name + settings_json.*) on the operator's behalf. Same
     * shape as the owner's self-serve update; merges settings_json.
     */
    public function updateRestaurant(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'settings_json' => ['sometimes', 'array'],
            ...RestaurantSettings::rules(),
        ]);

        if (array_key_exists('settings_json', $data)) {
            $data['settings_json'] = array_replace_recursive($tenant->settings_json ?? [], $data['settings_json']);
        }
        $tenant->fill($data)->save();

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'superadmin.restaurant_updated',
            'subject_type' => Tenant::class,
            'subject_id' => $tenant->id,
            'meta_json' => ['fields' => array_keys($data)],
            'ip' => $request->ip(),
        ]);

        return response()->json(['data' => [
            'id' => $tenant->id,
            'name' => $tenant->name,
            'settings' => $tenant->fresh()->settings_json ?? [],
        ]]);
    }

    /** DELETE /superadmin/tenants/{id} — soft-delete a tenant (recoverable). */
    public function deleteTenant(Request $request, string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'superadmin.tenant_deleted',
            'subject_type' => Tenant::class,
            'subject_id' => $tenant->id,
            'meta_json' => ['slug' => $tenant->slug, 'name' => $tenant->name],
            'ip' => $request->ip(),
        ]);

        $tenant->delete();

        return response()->json(['data' => ['deleted' => true]]);
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
