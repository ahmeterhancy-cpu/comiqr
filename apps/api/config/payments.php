<?php

return [
    // Default gateway when the client doesn't specify one.
    'default' => env('PAYMENT_DEFAULT_GATEWAY', 'cash'),

    // Gateways offered to customers (docs/04 §4.6). Online card = Tiko; cash is base.
    'enabled' => array_filter(explode(',', (string) env('PAYMENT_ENABLED', 'cash,tiko'))),

    // Customer result page the 3DS browser-return redirects to (web-customer).
    'result_url' => env('PAYMENT_RESULT_URL', 'http://localhost:3010/order-result'),

    // Owner billing page the subscription 3DS browser-return redirects to (web-admin).
    'admin_billing_url' => env('PAYMENT_ADMIN_BILLING_URL', 'http://localhost:3001/billing'),

    'gateways' => [
        // Tiko (tikokart.com) Virtual POS. Hash = base64(hmac_sha256(hashStr +
        // password, secret)); card data goes browser→Tiko via HTML form POST.
        'tiko' => [
            'merchant_id' => env('TIKO_MERCHANT_ID'),
            'secret' => env('TIKO_SECRET'),       // API Key (HMAC key)
            'password' => env('TIKO_PASSWORD'),   // appended to the hash string
            'base_url' => env('TIKO_BASE_URL', 'https://www.tikokart.com/api-sanalpos'),
            'is_test' => (bool) env('TIKO_IS_TEST', true),
            'currency' => env('TIKO_CURRENCY', 'TRY'),
            'url_ok' => env('TIKO_URL_OK'),       // falls back to the return route
            'url_fail' => env('TIKO_URL_FAIL'),
        ],
    ],
];
