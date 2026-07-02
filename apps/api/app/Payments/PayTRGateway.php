<?php

namespace App\Payments;

use App\Models\Payment;

/**
 * PayTR (M5, skeleton). Real integration returns an iframe token; here we build a
 * deterministic merchant_oid and a placeholder iframe URL, and verify the webhook
 * hash the PayTR way (base64(hmac_sha256(merchant_oid+salt+status+amount, key))).
 * Wire real credentials via config/payments.php before going live.
 */
class PayTRGateway implements PaymentGateway
{
    public function __construct(protected array $config = []) {}

    public function name(): string
    {
        return 'paytr';
    }

    public function initiate(Payment $payment): PaymentSession
    {
        $merchantOid = 'PTR'.$payment->id.'X'.substr(md5((string) $payment->created_at), 0, 8);
        $payment->update(['gateway_ref' => $merchantOid]);

        // Real flow: POST to PayTR get-token, then embed the iframe. Placeholder here.
        $url = ($this->config['iframe_base'] ?? 'https://www.paytr.com/odeme/guvenli').'/'.$merchantOid;

        return PaymentSession::iframe($url, $merchantOid, ['merchant_oid' => $merchantOid]);
    }

    public function verifyWebhook(array $payload, ?string $signature = null): bool
    {
        $key = $this->config['merchant_key'] ?? '';
        $salt = $this->config['merchant_salt'] ?? '';
        if ($key === '' || $salt === '') {
            return false;
        }

        $expected = base64_encode(hash_hmac(
            'sha256',
            ($payload['merchant_oid'] ?? '').$salt.($payload['status'] ?? '').($payload['total_amount'] ?? ''),
            $key,
            true,
        ));

        return isset($payload['hash']) && hash_equals($expected, (string) $payload['hash']);
    }

    public function referenceFrom(array $payload): ?string
    {
        return $payload['merchant_oid'] ?? null;
    }

    public function isSuccessful(array $payload): bool
    {
        return ($payload['status'] ?? null) === 'success';
    }
}
