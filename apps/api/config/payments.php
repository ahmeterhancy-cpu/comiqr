<?php

return [
    // Default gateway when the client doesn't specify one.
    'default' => env('PAYMENT_DEFAULT_GATEWAY', 'cash'),

    // Gateways offered to customers (docs/04 §4.6).
    'enabled' => array_filter(explode(',', (string) env('PAYMENT_ENABLED', 'cash,paytr,tiko'))),

    'gateways' => [
        'paytr' => [
            'merchant_id' => env('PAYTR_MERCHANT_ID'),
            'merchant_key' => env('PAYTR_MERCHANT_KEY'),
            'merchant_salt' => env('PAYTR_MERCHANT_SALT'),
            'iframe_base' => env('PAYTR_IFRAME_BASE', 'https://www.paytr.com/odeme/guvenli'),
        ],
        'tiko' => [
            'api_key' => env('TIKO_API_KEY'),
            'api_secret' => env('TIKO_API_SECRET'),
            'checkout_base' => env('TIKO_CHECKOUT_BASE', 'https://checkout.tiko.example'),
        ],
    ],
];
