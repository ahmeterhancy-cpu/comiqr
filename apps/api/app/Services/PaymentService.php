<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Payments\PaymentManager;
use App\Payments\PaymentSession;
use Illuminate\Support\Facades\DB;

/**
 * Payment orchestration (M5, docs/04 §4.6). Creates payment rows, delegates to
 * the gateway, and reconciles the order's payment_status. Money is server-side;
 * card data never reaches us.
 */
class PaymentService
{
    public function __construct(
        protected PaymentManager $gateways,
        protected LoyaltyService $loyalty,
    ) {}

    /**
     * Start a payment for an order. Cash completes immediately. An explicit
     * $amount enables bill splitting (each guest pays a share); it is capped at
     * the outstanding balance.
     */
    public function initiate(Order $order, string $gatewayName, float $tip = 0, ?float $amount = null, array $context = []): array
    {
        $gateway = $this->gateways->gateway($gatewayName);

        return DB::transaction(function () use ($order, $gateway, $gatewayName, $tip, $amount, $context) {
            // Principal still owed BEFORE this tip — grand_total already reflects
            // any earlier tips. A tip is extra money that both grows the bill and
            // helps settle it, so it must never inflate the collectable principal.
            $owed = $this->outstanding($order);
            $payAmount = $amount === null ? $owed : min($amount, $owed);

            if ($tip > 0) {
                $order->update(['tip_total' => (float) $order->tip_total + $tip]);
                $order->recalculateTotals();
            }

            $payment = Payment::create([
                'order_id' => $order->id,
                'gateway' => $gatewayName,
                'amount' => $payAmount,
                'tip_amount' => $tip,
                'status' => 'initiated',
            ]);

            $session = $gateway->initiate($payment, $context);

            if ($session->isCompleted()) {
                $this->finalize($payment->fresh(), $session->ref);
            }

            return ['payment' => $payment->fresh(), 'session' => $session];
        });
    }

    /** Handle a verified, successful webhook: mark the payment + order paid. */
    public function confirmByReference(string $ref): ?Payment
    {
        $payment = Payment::where('gateway_ref', $ref)->where('status', 'initiated')->first();
        if (! $payment) {
            return null;
        }

        $this->finalize($payment, $ref);

        return $payment->fresh();
    }

    protected function finalize(Payment $payment, ?string $ref = null): void
    {
        $payment->markPaid($ref);

        $order = $payment->order;
        $collected = $this->collected($order);
        $fullyPaid = $collected + 0.001 >= (float) $order->grand_total;
        $order->update(['payment_status' => $fullyPaid ? 'paid' : 'partially_paid']);

        // Award loyalty points once the order is fully paid (M8).
        if ($fullyPaid) {
            $this->loyalty->earnForOrder($order->fresh());
        }
    }

    /** Total money collected toward the order — principals plus tips (server-side). */
    protected function collected(Order $order): float
    {
        $row = $order->payments()->where('status', 'paid')
            ->selectRaw('COALESCE(SUM(amount), 0) as a, COALESCE(SUM(tip_amount), 0) as t')
            ->first();

        return round((float) $row->a + (float) $row->t, 2);
    }

    protected function outstanding(Order $order): float
    {
        return max(0, round((float) $order->grand_total - $this->collected($order), 2));
    }

    public function outstandingFor(Order $order): float
    {
        return $this->outstanding($order);
    }

    public function collectedFor(Order $order): float
    {
        return $this->collected($order);
    }

    /**
     * Refund money already collected on an order (Faz 3 — ultra POS). Recorded as
     * a negative settled payment so it nets out of `collected()` and pulls the
     * matching cash/card back out of the shift drawer. Capped at what was collected.
     */
    public function refund(Order $order, float $amount, string $gateway, ?string $reason = null): Payment
    {
        return DB::transaction(function () use ($order, $amount, $gateway, $reason) {
            // Serialize concurrent refunds on this order so two can't both clear the cap.
            Order::whereKey($order->id)->lockForUpdate()->first();

            // Never refund more than was collected via this same tender — a cash
            // refund must not pull the drawer for money that came in on card.
            $refund = min(round(max(0, $amount), 2), $this->collectedVia($order, $gateway));

            $payment = Payment::create([
                'order_id' => $order->id,
                'gateway' => $gateway,
                'amount' => -$refund,
                'tip_amount' => 0,
                'status' => 'paid', // settled refund line
                'gateway_ref' => 'refund_'.bin2hex(random_bytes(6)),
                'split_meta_json' => ['refund' => true, 'reason' => $reason],
            ]);

            $fresh = $order->fresh();
            $this->reconcile($fresh);
            // A no-longer-fully-paid sale must not leave the customer holding its points.
            if ($fresh->fresh()->payment_status !== 'paid') {
                $this->loyalty->reverseEarnForOrder($fresh->fresh());
            }

            return $payment;
        });
    }

    /** Money collected on the order via a specific tender (principal + tips). */
    public function collectedVia(Order $order, string $gateway): float
    {
        $row = $order->payments()->where('status', 'paid')->where('gateway', $gateway)
            ->selectRaw('COALESCE(SUM(amount), 0) as a, COALESCE(SUM(tip_amount), 0) as t')
            ->first();

        return round((float) $row->a + (float) $row->t, 2);
    }

    /** Re-derive payment_status from what is net-collected (after a refund or void). */
    public function reconcile(Order $order): void
    {
        $collected = $this->collected($order);
        $grand = (float) $order->grand_total;

        $status = $collected + 0.001 >= $grand
            ? 'paid'
            : ($collected > 0.001 ? 'partially_paid' : 'unpaid');

        $order->update(['payment_status' => $status]);
    }
}
