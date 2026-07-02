<?php

namespace App\Payments;

use App\Models\Payment;

/**
 * Tiko (M5, skeleton — local TRNC gateway). Generic redirect + HMAC webhook
 * verification; swap in the real endpoints/signing once credentials are set.
 */
class TikoGateway implements PaymentGateway
{
    public function __construct(protected array $config = []) {}

    public function name(): string
    {
        return 'tiko';
    }

    public function initiate(Payment $payment): PaymentSession
    {
        $ref = 'TIKO'.$payment->id.'X'.substr(md5((string) $payment->created_at), 0, 8);
        $payment->update(['gateway_ref' => $ref]);

        $url = ($this->config['checkout_base'] ?? 'https://checkout.tiko.example').'/pay/'.$ref;

        return PaymentSession::redirect($url, $ref);
    }

    public function verifyWebhook(array $payload, ?string $signature = null): bool
    {
        $secret = $this->config['api_secret'] ?? '';
        if ($secret === '' || $signature === null) {
            return false;
        }

        $expected = hash_hmac('sha256', ($payload['ref'] ?? '').($payload['status'] ?? '').($payload['amount'] ?? ''), $secret);

        return hash_equals($expected, $signature);
    }

    public function referenceFrom(array $payload): ?string
    {
        return $payload['ref'] ?? null;
    }

    public function isSuccessful(array $payload): bool
    {
        return ($payload['status'] ?? null) === 'paid';
    }
}
