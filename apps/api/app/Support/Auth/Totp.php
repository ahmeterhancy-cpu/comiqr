<?php

namespace App\Support\Auth;

/**
 * RFC 6238 time-based one-time passwords (M12 2FA). No external dependency — a
 * small, testable HOTP/TOTP + RFC 4648 base32 implementation compatible with
 * Google Authenticator / Authy (SHA1, 6 digits, 30-second step).
 */
class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public const STEP = 30;

    public const DIGITS = 6;

    /** A fresh random base32 secret (default 160 bits, like most authenticators). */
    public static function generateSecret(int $bytes = 20): string
    {
        return self::base32Encode(random_bytes($bytes));
    }

    /** The current 6-digit code for a secret at a given unix time (default: now). */
    public static function codeAt(string $secret, ?int $timestamp = null): string
    {
        $timestamp ??= time();

        return self::hotp(self::base32Decode($secret), intdiv($timestamp, self::STEP));
    }

    /**
     * Verify a code, tolerating ±$window steps of clock drift. Comparison is
     * constant-time. A blank/short code never verifies.
     */
    public static function verify(string $secret, string $code, int $window = 1, ?int $timestamp = null): bool
    {
        $code = preg_replace('/\s+/', '', $code);
        if (strlen($code) !== self::DIGITS) {
            return false;
        }

        $timestamp ??= time();
        $counter = intdiv($timestamp, self::STEP);
        $binary = self::base32Decode($secret);

        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::hotp($binary, $counter + $i), $code)) {
                return true;
            }
        }

        return false;
    }

    /** otpauth:// URI for QR provisioning in an authenticator app. */
    public static function provisioningUri(string $secret, string $account, string $issuer): string
    {
        $label = rawurlencode($issuer.':'.$account);
        $query = http_build_query([
            'secret' => $secret,
            'issuer' => $issuer,
            'algorithm' => 'SHA1',
            'digits' => self::DIGITS,
            'period' => self::STEP,
        ]);

        return "otpauth://totp/{$label}?{$query}";
    }

    /** RFC 4226 HOTP for a counter over raw-binary key material. */
    private static function hotp(string $key, int $counter): string
    {
        $hash = hash_hmac('sha1', pack('J', $counter), $key, true);
        $offset = ord($hash[19]) & 0x0f;
        $truncated = (
            ((ord($hash[$offset]) & 0x7f) << 24) |
            ((ord($hash[$offset + 1]) & 0xff) << 16) |
            ((ord($hash[$offset + 2]) & 0xff) << 8) |
            (ord($hash[$offset + 3]) & 0xff)
        );

        return str_pad((string) ($truncated % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    public static function base32Encode(string $binary): string
    {
        $bits = '';
        foreach (str_split($binary) as $char) {
            $bits .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }

        $out = '';
        foreach (str_split($bits, 5) as $chunk) {
            $out .= self::ALPHABET[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
        }

        return $out;
    }

    private static function base32Decode(string $secret): string
    {
        $secret = strtoupper(preg_replace('/[^A-Z2-7]/i', '', $secret));

        $bits = '';
        foreach (str_split($secret) as $char) {
            $bits .= str_pad(decbin(strpos(self::ALPHABET, $char)), 5, '0', STR_PAD_LEFT);
        }

        $binary = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $binary .= chr(bindec($byte));
            }
        }

        return $binary;
    }
}
