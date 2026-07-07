<?php

use function Pest\Laravel\getJson;

it('sends baseline security headers on API responses', function () {
    getJson('/v1/ping')
        ->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
});
