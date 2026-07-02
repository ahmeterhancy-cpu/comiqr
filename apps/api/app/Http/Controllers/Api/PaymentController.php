<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesQrToken;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\Payment;
use App\Payments\PaymentManager;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Payments (M5, docs/06 §6.4). Customer pay is nested under the table qr_token;
 * webhooks are public but signature-verified. Card data never reaches us.
 */
class PaymentController extends Controller
{
    use ResolvesQrToken;

    public function __construct(
        protected PaymentService $payments,
        protected PaymentManager $gateways,
    ) {}

    /** POST /sessions/{qrToken}/orders/{order}/pay */
    public function pay(Request $request, string $qrToken, string $order): JsonResponse
    {
        $data = $request->validate([
            'gateway' => ['nullable', 'string'],
            'tip' => ['nullable', 'numeric', 'min:0'],
            // Partial amount → bill splitting (each guest pays a share).
            'amount' => ['nullable', 'numeric', 'gt:0'],
        ]);

        $gateway = $data['gateway'] ?? config('payments.default', 'cash');
        abort_unless($this->gateways->isEnabled($gateway), 422, 'Payment method not available.');

        $model = $this->orderForToken($qrToken, $order);
        abort_if($model->payment_status === 'paid', 422, 'Order already paid.');

        ['payment' => $payment, 'session' => $session] = $this->payments->initiate(
            $model,
            $gateway,
            (float) ($data['tip'] ?? 0),
            isset($data['amount']) ? (float) $data['amount'] : null,
        );

        return response()->json(['data' => [
            'payment' => [
                'id' => $payment->id,
                'gateway' => $payment->gateway,
                'amount' => $payment->amount,
                'status' => $payment->status,
            ],
            'session' => $session->toArray(),
            'order' => new OrderResource($model->fresh()),
        ]], 201);
    }

    /** POST /payments/webhook/{gateway} — signature-verified provider callback. */
    public function webhook(Request $request, string $gateway): JsonResponse
    {
        abort_unless($this->gateways->isEnabled($gateway), 404);

        $impl = $this->gateways->gateway($gateway);
        $payload = $request->all();
        $signature = $request->header('X-Signature');

        abort_unless($impl->verifyWebhook($payload, $signature), 403, 'Invalid signature.');

        if ($impl->isSuccessful($payload) && ($ref = $impl->referenceFrom($payload))) {
            $this->payments->confirmByReference($ref);
        }

        // Gateways expect a plain OK acknowledgement.
        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * GET|POST /payments/return/{gateway} — the browser POST-redirect the gateway
     * sends after 3D Secure (Tiko UrlOk/UrlFail). We verify the signature, confirm
     * the payment when successful, then 302 the guest to the customer result page.
     */
    public function paymentReturn(Request $request, string $gateway): RedirectResponse
    {
        $resultUrl = rtrim((string) config('payments.result_url', 'http://localhost:3010/order-result'), '/');

        if (! $this->gateways->isEnabled($gateway)) {
            return redirect()->away($resultUrl.'?status=error');
        }

        $impl = $this->gateways->gateway($gateway);
        $payload = $request->all();

        $success = $impl->verifyWebhook($payload) && $impl->isSuccessful($payload);
        $ref = $impl->referenceFrom($payload);

        $orderId = null;
        if ($ref !== null) {
            $payment = Payment::withoutTenancy()->where('gateway_ref', $ref)->with('order')->first();
            $orderId = $payment?->order_id;
            if ($success && $payment) {
                $this->payments->confirmByReference($ref);
                $this->captureSavedCard($payment, $payload);
            }
        }

        return redirect()->away(
            $resultUrl.'?status='.($success ? 'paid' : 'failed').($orderId ? '&order='.$orderId : ''),
        );
    }

    /** Persist a Tiko-tokenised card (CardId) when the gateway returned one. */
    private function captureSavedCard(Payment $payment, array $payload): void
    {
        $cardId = $payload['CardId'] ?? null;
        $customerId = $payment->order?->customer_id;
        if (! $cardId || ! $customerId) {
            return;
        }

        \App\Models\SavedCard::firstOrCreate(
            ['customer_id' => $customerId, 'tiko_card_id' => (string) $cardId],
            ['tenant_id' => $payment->tenant_id, 'alias' => $payload['Alias'] ?? 'Kartım', 'last4' => $payload['CardLast4'] ?? null],
        );
    }

    private function orderForToken(string $qrToken, string $orderId): Order
    {
        [$table] = $this->resolveByToken($qrToken);

        $order = Order::with('tableSession')->find($orderId);
        abort_if($order === null || $order->tableSession?->table_id !== $table->id, 404, 'Order not found.');

        return $order;
    }
}
