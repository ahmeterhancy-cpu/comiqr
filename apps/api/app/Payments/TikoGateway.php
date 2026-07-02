<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Support\Facades\Http;

/**
 * Tiko (tikokart.com) Virtual POS — 3D Secure (M5, docs.tikokart.com).
 *
 * Flow: we build the pay3d form fields + Hash server-side (Hash needs the secret,
 * never the card), the browser renders a card form that POSTs to Tiko's pay3d,
 * and Tiko POST-redirects back to UrlOk/UrlFail with Status/TransId/Hash which we
 * verify. Card data never reaches this app (PCI).
 *
 * Hash = base64( hmac_sha256( hashStr + password, secret ) )  (docs: hash-olusturma)
 *   request  hashStr = MerchantId+UserIp+OrderId+UrlOk+UrlFail+Amount+Currency+Installment+IsTest [+CardId]
 *   response hashStr = MerchantId+OrderId+Amount+Currency+Installment+TransId
 *
 * NOTE: the docs' 3D page shows a simplified plain-sha256 sample that conflicts
 * with the canonical hash-olusturma page (HMAC used here). Verify against Tiko's
 * IsTest=1 environment before go-live.
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
        $orderId = 'TIKO'.$payment->id.'X'.substr(md5((string) $payment->created_at), 0, 8);
        $payment->update(['gateway_ref' => $orderId]);

        $merchantId = (string) ($this->config['merchant_id'] ?? '');
        $amount = number_format((float) $payment->amount, 2, '.', '');
        $currency = (string) ($this->config['currency'] ?? 'TRY');
        $installment = '0';
        $isTest = ($this->config['is_test'] ?? true) ? '1' : '0';
        $ip = request()?->ip() ?: '0.0.0.0';
        $urlOk = (string) ($this->config['url_ok'] ?? url('/v1/payments/return/tiko'));
        $urlFail = (string) ($this->config['url_fail'] ?? url('/v1/payments/return/tiko'));

        $customer = $payment->order?->customer;
        $userName = $customer?->name ?: 'Musteri';
        $userEmail = $customer?->email ?: 'guest@comiqr.app';

        $hashStr = $merchantId.$ip.$orderId.$urlOk.$urlFail.$amount.$currency.$installment.$isTest;

        $fields = [
            'MerchantId' => $merchantId,
            'OrderId' => $orderId,
            'Amount' => $amount,
            'Currency' => $currency,
            'Installment' => $installment,
            'UrlOk' => $urlOk,
            'UrlFail' => $urlFail,
            'UserIp' => $ip,
            'UserName' => $userName,
            'UserEmail' => $userEmail,
            'IsTest' => $isTest,
            'Hash' => $this->hash($hashStr),
        ];

        // Card fields (CardNo/CardCvv/…) are intentionally omitted — the browser
        // collects them and posts them straight to Tiko.
        return PaymentSession::form(
            rtrim((string) ($this->config['base_url'] ?? ''), '/').'/gateway/pay3d',
            $fields,
            $orderId,
        );
    }

    public function verifyWebhook(array $payload, ?string $signature = null): bool
    {
        if (empty($this->config['secret'])) {
            return false;
        }

        $hashStr = ($payload['MerchantId'] ?? '')
            .($payload['OrderId'] ?? '')
            .($payload['Amount'] ?? '')
            .($payload['Currency'] ?? '')
            .($payload['Installment'] ?? '')
            .($payload['TransId'] ?? '');

        $given = (string) ($payload['Hash'] ?? $signature ?? '');

        return $given !== '' && hash_equals($this->hash($hashStr), $given);
    }

    public function referenceFrom(array $payload): ?string
    {
        return $payload['OrderId'] ?? null;
    }

    public function isSuccessful(array $payload): bool
    {
        return (string) ($payload['Status'] ?? '') === '200';
    }

    /**
     * Create a recurring plan (SaaS subscription billing, docs: tekrarli-odeme).
     * POST JSON to /recurring/create. Hash = MerchantId+CustomerPhone+Amount+Currency.
     * Tiko sends the customer an SMS link (LinkSend) to authorise the mandate.
     *
     * @param  array{customer_name:string,customer_phone:string,amount:float|string,currency?:string,first_collection_date:string,frequency?:string,end_condition?:string,total_payment_count?:int,end_date?:string,plan_name?:string,message_template?:string}  $data
     * @return array<string,mixed>
     */
    public function createRecurring(array $data): array
    {
        $merchantId = (string) ($this->config['merchant_id'] ?? '');
        $currency = (string) ($data['currency'] ?? $this->config['currency'] ?? 'TRY');
        $amount = number_format((float) $data['amount'], 2, '.', '');
        $phone = (string) $data['customer_phone'];

        $body = array_filter([
            'MerchantId' => $merchantId,
            'CustomerFullName' => $data['customer_name'],
            'CustomerPhone' => $phone,
            'Currency' => $currency,
            'Amount' => (float) $amount,
            'PlanName' => $data['plan_name'] ?? null,
            'FirstCollectionDate' => $data['first_collection_date'],
            'Frequency' => $data['frequency'] ?? 'Monthly',
            'EndCondition' => $data['end_condition'] ?? 'Never',
            'TotalPaymentCount' => $data['total_payment_count'] ?? null,
            'EndDate' => $data['end_date'] ?? null,
            'MessageTemplate' => $data['message_template'] ?? 'Aboneliğiniz için: {{Link}}',
            'Hash' => $this->hash($merchantId.$phone.$amount.$currency),
        ], fn ($v) => $v !== null);

        $response = Http::asJson()->timeout(15)
            ->post(rtrim((string) ($this->config['base_url'] ?? ''), '/').'/recurring/create', $body);

        return (array) ($response->json() ?? []);
    }

    /** base64( hmac_sha256( hashStr + password, secret ) ). Nulls → "". */
    public function hash(string $hashStr): string
    {
        return base64_encode(hash_hmac(
            'sha256',
            $hashStr.(string) ($this->config['password'] ?? ''),
            (string) ($this->config['secret'] ?? ''),
            true,
        ));
    }
}
