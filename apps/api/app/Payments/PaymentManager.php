<?php

namespace App\Payments;

use InvalidArgumentException;

/**
 * Resolves a {@see PaymentGateway} by name (docs/04 §4.6). New provider = a new
 * class + a case here.
 */
class PaymentManager
{
    public function gateway(?string $name = null): PaymentGateway
    {
        $name ??= config('payments.default', 'cash');

        return match ($name) {
            'cash' => new CashGateway,
            'card' => new CardGateway,
            'tiko' => new TikoGateway((array) config('payments.gateways.tiko', [])),
            default => throw new InvalidArgumentException("Unknown payment gateway: {$name}"),
        };
    }

    /** @return array<int,string> */
    public function enabled(): array
    {
        return (array) config('payments.enabled', ['cash']);
    }

    public function isEnabled(string $name): bool
    {
        return in_array($name, $this->enabled(), true);
    }
}
