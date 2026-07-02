<?php

use App\Support\Auth\Totp;

it('matches the RFC 6238 SHA1 test vectors (6-digit)', function () {
    // RFC 6238 Appendix B seed: ASCII "12345678901234567890" (20 bytes).
    $secret = Totp::base32Encode('12345678901234567890');

    // T=59 → 8-digit 94287082 → 6-digit 287082.
    expect(Totp::codeAt($secret, 59))->toBe('287082');
    // T=1111111109 → 8-digit 07081804 → 6-digit 081804.
    expect(Totp::codeAt($secret, 1111111109))->toBe('081804');
    // T=1234567890 → 8-digit 89005924 → 6-digit 005924.
    expect(Totp::codeAt($secret, 1234567890))->toBe('005924');
});

it('verifies within the drift window and rejects otherwise', function () {
    $secret = Totp::generateSecret();
    $t = 1700000000;

    expect(Totp::verify($secret, Totp::codeAt($secret, $t), 1, $t))->toBeTrue();
    // One step behind is still accepted (±1 window).
    expect(Totp::verify($secret, Totp::codeAt($secret, $t - 30), 1, $t))->toBeTrue();
    // Three steps away is outside the window.
    expect(Totp::verify($secret, Totp::codeAt($secret, $t - 90), 1, $t))->toBeFalse();
    // Wrong / malformed codes never verify.
    expect(Totp::verify($secret, '000000', 1, $t))->toBeFalse();
    expect(Totp::verify($secret, 'abc', 1, $t))->toBeFalse();
});

it('round-trips base32', function () {
    $raw = random_bytes(20);
    expect(Totp::base32Encode($raw))->toMatch('/^[A-Z2-7]+$/');
});
