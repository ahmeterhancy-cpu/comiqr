<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesQrToken;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Payments\PaymentManager;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
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
        ]);

        $gateway = $data['gateway'] ?? config('payments.default', 'cash');
        abort_unless($this->gateways->isEnabled($gateway), 422, 'Payment method not available.');

        $model = $this->orderForToken($qrToken, $order);
        abort_if($model->payment_status === 'paid', 422, 'Order already paid.');

        ['payment' => $payment, 'session' => $session] = $this->payments->initiate(
            $model,
            $gateway,
            (float) ($data['tip'] ?? 0),
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

    private function orderForToken(string $qrToken, string $orderId): Order
    {
        [$table] = $this->resolveByToken($qrToken);

        $order = Order::with('tableSession')->find($orderId);
        abort_if($order === null || $order->tableSession?->table_id !== $table->id, 404, 'Order not found.');

        return $order;
    }
}
