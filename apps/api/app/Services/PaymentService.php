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
}
