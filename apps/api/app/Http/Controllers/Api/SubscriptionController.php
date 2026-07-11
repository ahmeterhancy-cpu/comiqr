<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Payments\TikoGateway;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Owner self-serve SaaS subscription. The signed-in owner enters their card on the
 * billing page; it posts straight to Tiko's pay3d (card data never reaches us — PCI)
 * with SaveCard, so the first period is charged and the card is tokenised for the
 * next period. Tiko POST-redirects the browser back to `paymentReturn`, which
 * activates the subscription and stores the card token.
 */
class SubscriptionController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    private function tiko(): TikoGateway
    {
        return new TikoGateway((array) config('payments.gateways.tiko'));
    }

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
                'current_period_end' => $sub->current_period_end,
                'grace_ends_at' => $sub->grace_ends_at,
                'card_last4' => $sub->card_last4,
                'card_brand' => $sub->card_brand,
            ] : null,
        ]]);
    }

    /**
     * POST /subscription — begin card-on-page checkout for the owner's chosen plan.
     * Returns a Tiko pay3d session (url + hidden fields); the browser adds the card
     * fields and posts them straight to Tiko. On success Tiko redirects to
     * `paymentReturn`, which activates the subscription and stores the card token.
     */
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
        // Optional contact number (receipts / dunning) — no longer required, the card
        // is collected on the page rather than via an SMS mandate.
        if (! empty($data['phone'])) {
            $owner->update(['phone' => $data['phone']]);
        }

        // Reserve the row up-front (still "pending" until the 3DS return confirms) so the
        // OrderId we hand Tiko is stable and matches the row we look up on return.
        $subscription = Subscription::updateOrCreate(
            ['tenant_id' => $tenant->id],
            ['plan_id' => $plan->id, 'billing_cycle' => $cycle, 'status' => 'pending_authorization'],
        );

        $orderId = 'SUB'.$subscription->id.'X'.substr(md5($tenant->id.'|'.now()->timestamp), 0, 8);
        $subscription->update(['gateway_ref' => $orderId]);

        $session = $this->tiko()->subscriptionSession([
            'order_id' => $orderId,
            'amount' => $amount,
            'currency' => $plan->currency,
            'customer_name' => $owner->name,
            'customer_email' => $owner->email,
            'save_card' => true,
            'card_group_key' => 'tenant-'.$tenant->id,
            'alias' => $plan->name.' aboneliği',
            'url_ok' => url('/v1/subscription/return/tiko'),
            'url_fail' => url('/v1/subscription/return/tiko'),
        ]);

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'subscription.checkout_started',
            'subject_type' => Subscription::class,
            'subject_id' => $subscription->id,
            'meta_json' => ['plan' => $plan->code, 'cycle' => $cycle, 'amount' => $amount, 'order_id' => $orderId],
            'ip' => $request->ip(),
        ]);

        return response()->json(['data' => [
            'subscription' => [
                'plan' => $plan->name,
                'status' => $subscription->status,
                'billing_cycle' => $subscription->billing_cycle,
                'amount' => $amount,
                'currency' => $plan->currency,
            ],
            'session' => $session->toArray(),
        ]]);
    }

    /**
     * GET|POST /subscription/return/tiko — the browser POST-redirect Tiko sends after
     * 3D Secure. We verify the signature, and on success activate the subscription,
     * extend the period, and store the tokenised card. Public (no tenant/auth context),
     * so all lookups run withoutTenancy. Always 302s the owner back to the billing page.
     */
    public function paymentReturn(Request $request): RedirectResponse
    {
        $billingUrl = rtrim((string) config('payments.admin_billing_url', 'http://localhost:3001/billing'), '/');
        $payload = $request->all();

        $tiko = $this->tiko();
        $success = $tiko->verifyWebhook($payload) && $tiko->isSuccessful($payload);
        $orderId = $tiko->referenceFrom($payload);

        if ($orderId === null) {
            return redirect()->away($billingUrl.'?billing=error');
        }

        $sub = Subscription::withoutTenancy()->where('gateway_ref', $orderId)->first();
        if ($sub === null) {
            return redirect()->away($billingUrl.'?billing=error');
        }

        if (! $success) {
            // First-time authorisation failed → leave the row pending so the owner can retry.
            return redirect()->away($billingUrl.'?billing=failed');
        }

        $periodEnd = $sub->billing_cycle === 'yearly' ? now()->addYear() : now()->addMonth();
        $sub->markPaid($periodEnd);

        // Persist the tokenised card so we can re-charge next period and show the masked card.
        $card = array_filter([
            'card_ref' => $payload['CardId'] ?? null,
            'card_last4' => $payload['CardLast4'] ?? ($payload['Last4'] ?? null),
            'card_brand' => $payload['CardBrand'] ?? ($payload['CardType'] ?? null),
        ], fn ($v) => $v !== null && $v !== '');
        if ($card !== []) {
            $sub->update($card);
        }

        Tenant::whereKey($sub->tenant_id)->update(['plan_id' => $sub->plan_id, 'status' => 'active']);

        AuditLog::withoutTenancy()->create([
            'tenant_id' => $sub->tenant_id,
            'user_id' => null,
            'action' => 'subscription.activated',
            'subject_type' => Subscription::class,
            'subject_id' => $sub->id,
            'meta_json' => ['order_id' => $orderId, 'period_end' => $periodEnd->toIso8601String()],
            'ip' => $request->ip(),
        ]);

        return redirect()->away($billingUrl.'?billing=success');
    }

    /**
     * POST /webhooks/tiko/recurring — Tiko reports the result of a recurring charge.
     * On failure the subscription goes past_due with a +GRACE_DAYS window; on success
     * it returns to active and the period is extended. Public (no tenant/auth context).
     */
    public function webhook(Request $request): JsonResponse
    {
        $ref = (string) ($request->input('recurring_id') ?? $request->input('Id') ?? $request->input('gateway_ref') ?? '');
        if ($ref === '') {
            return response()->json(['data' => ['ignored' => 'no_ref']]);
        }

        $sub = Subscription::withoutTenancy()->where('gateway_ref', $ref)->first();
        if ($sub === null) {
            return response()->json(['data' => ['ignored' => 'not_found']]);
        }

        $ok = filter_var($request->input('success', $request->input('paid', false)), FILTER_VALIDATE_BOOLEAN)
            || in_array((string) $request->input('status'), ['paid', 'success', '200'], true);

        if ($ok) {
            $sub->markPaid($sub->billing_cycle === 'yearly' ? now()->addYear() : now()->addMonth());
        } else {
            $sub->markPaymentFailed();
        }

        return response()->json(['data' => ['status' => $sub->status]]);
    }
}
