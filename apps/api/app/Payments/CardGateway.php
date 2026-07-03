<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Support\Str;

/**
 * Counter card payment (Faz 3, staff POS). A physical card terminal settles the
 * card outside the app; staff record it here and it completes immediately — like
 * cash, but tracked as `card` for accurate reporting.
 */
class CardGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'card';
    }

    public function initiate(Payment $payment, array $context = []): PaymentSession
    {
        return PaymentSession::completed('card_'.Str::lower(Str::random(16)));
    }

    public function verifyWebhook(array $payload, ?string $signature = null): bool
    {
        return false;
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
