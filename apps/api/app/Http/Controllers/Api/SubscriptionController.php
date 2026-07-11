<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Payments\TikoGateway;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Owner self-serve SaaS subscription (Tiko recurring). The signed-in owner starts
 * recurring billing for their tenant's chosen plan; Tiko SMS-links the owner to
 * authorise the mandate, so we store the recurring id as pending until then.
 * (Mirrors the superadmin-driven SuperadminController@startSubscription.)
 */
class SubscriptionController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    /** GET /subscription — current trial/subscription status for the owner's tenant. */
    public function show(): JsonResponse
    {
        $tenant = $this->tenants->get();
        $sub = Subscription::where('tenant_id', $tenant->id)->first();
        $owner = User::query()->where('tenant_id', $tenant->id)->where('role', Role::Owner->value)->first();
        $plan = $tenant->plan_id ? Plan::find($tenant->plan_id) : null;

        return response()->json(['data' => [
            'tenant_status' => $tenant->status,
            'trial_ends_at' => $tenant->trial_ends_at,
            'plan_code' => $plan?->code,
            'plan_name' => $plan?->name,
            'owner_phone' => $owner?->phone,
            'subscription' => $sub ? [
                'status' => $sub->status,
                'billing_cycle' => $sub->billing_cycle,
            ] : null,
        ]]);
    }

    /** POST /subscription — start Tiko recurring billing for the owner's chosen plan. */
    public function start(Request $request): JsonResponse
    {
        $tenant = $this->tenants->get();
        $data = $request->validate([
            'plan' => ['required', Rule::exists('plans', 'code')],
            'billing_cycle' => ['nullable', Rule::in(['monthly', 'yearly'])],
            'phone' => ['nullable', 'string', 'max:40'],
        ]);

        $plan = Plan::where('code', $data['plan'])->firstOrFail();
        $cycle = $data['billing_cycle'] ?? 'monthly';
        $amount = (float) ($cycle === 'yearly' ? $plan->price_yearly : $plan->price_monthly);
        abort_if($amount <= 0, 422, 'Bu plan için tahsil edilecek tutar yok (ücretsiz plan).');

        $owner = User::query()->where('tenant_id', $tenant->id)->where('role', Role::Owner->value)->first();
        abort_if($owner === null, 422, 'İşletme sahibi bulunamadı.');

        // The recurring mandate is SMS-linked to the owner's phone, so it's required.
        if (! empty($data['phone'])) {
            $owner->update(['phone' => $data['phone']]);
        }
        abort_if(empty($owner->phone), 422, 'Aboneliği başlatmak için telefon numarası gerekli.');

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

        abort_if((string) ($result['Status'] ?? '') !== '200', 422, 'Ödeme başlatılamadı, lütfen tekrar deneyin.');

        $recurringId = (string) ($result['Result']['Id'] ?? '');

        $subscription = Subscription::updateOrCreate(
            ['tenant_id' => $tenant->id],
            ['plan_id' => $plan->id, 'status' => 'pending_authorization', 'billing_cycle' => $cycle, 'gateway_ref' => $recurringId],
        );
        $tenant->update(['plan_id' => $plan->id]);

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'subscription.started',
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
            ],
            'sms_sent' => true,
        ]]);
    }
}
