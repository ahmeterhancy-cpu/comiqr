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
    public function __construct(protected PaymentManager $gateways) {}

    /**
     * Start a payment for an order. Cash completes immediately. An explicit
     * $amount enables bill splitting (each guest pays a share); it is capped at
     * the outstanding balance.
     */
    public function initiate(Order $order, string $gatewayName, float $tip = 0, ?float $amount = null): array
    {
        $gateway = $this->gateways->gateway($gatewayName);

        return DB::transaction(function () use ($order, $gateway, $gatewayName, $tip, $amount) {
            if ($tip > 0) {
                $order->update(['tip_total' => (float) $order->tip_total + $tip]);
                $order->recalculateTotals();
            }

            $outstanding = $this->outstanding($order);
            $payAmount = $amount === null ? $outstanding : min($amount, $outstanding);

            $payment = Payment::create([
                'order_id' => $order->id,
                'gateway' => $gatewayName,
                'amount' => $payAmount,
                'tip_amount' => $tip,
                'status' => 'initiated',
            ]);

            $session = $gateway->initiate($payment);

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
        $paid = (float) $order->payments()->where('status', 'paid')->sum('amount');
        $order->update([
            'payment_status' => $paid + 0.001 >= (float) $order->grand_total ? 'paid' : 'partially_paid',
        ]);
    }

    protected function outstanding(Order $order): float
    {
        $paid = (float) $order->payments()->where('status', 'paid')->sum('amount');

        return max(0, round((float) $order->grand_total - $paid, 2));
    }

    public function outstandingFor(Order $order): float
    {
        return $this->outstanding($order);
    }
}
