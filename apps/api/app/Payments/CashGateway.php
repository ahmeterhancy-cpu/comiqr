<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Support\Str;

/**
 * Cash / pay-at-counter (M5). No external call — the payment completes
 * immediately and staff confirm collection in person.
 */
class CashGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'cash';
    }

    public function initiate(Payment $payment, array $context = []): PaymentSession
    {
        return PaymentSession::completed('cash_'.Str::lower(Str::random(16)));
    }

    public function verifyWebhook(array $payload, ?string $signature = null): bool
    {
        return false; // cash has no webhook
    }

    public function referenceFrom(array $payload): ?string
    {
        return null;
    }

    public function isSuccessful(array $payload): bool
    {
        return false;
    }
}
