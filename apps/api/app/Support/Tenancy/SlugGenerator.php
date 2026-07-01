<?php

namespace App\Support\Tenancy;

use App\Models\Tenant;
use Illuminate\Support\Str;

/**
 * Generates DNS-safe, unique tenant subdomain slugs (docs/04 §4.2).
 * Rejects reserved central hostnames so a tenant can never shadow api/admin/etc.
 */
class SlugGenerator
{
    /** Reserved labels that must never become a tenant subdomain. */
    public const RESERVED = [
        'www', 'api', 'admin', 'kds', 'app', 'apps', 'portal', 'discover',
        'superadmin', 'mail', 'smtp', 'ftp', 'ws', 'cdn', 'static', 'assets',
        'status', 'help', 'support', 'billing', 'account', 'auth', 'login',
        'dashboard', 'panel', 'kiosk', 'signage', 'blog', 'docs', 'dev', 'staging',
    ];

    public function fromName(string $name): string
    {
        $base = $this->normalize($name);

        return $this->unique($base);
    }

    /** Validate/normalize a user-supplied slug and ensure it is free. */
    public function fromDesired(string $desired): string
    {
        $base = $this->normalize($desired);

        return $this->unique($base);
    }

    public function isReserved(string $slug): bool
    {
        return in_array($slug, self::RESERVED, true);
    }

    public function isAvailable(string $slug): bool
    {
        return ! $this->isReserved($slug)
            && ! Tenant::query()->where('slug', $slug)->withTrashed()->exists();
    }

    protected function normalize(string $value): string
    {
        $slug = Str::slug($value);
        $slug = trim($slug, '-');

        if ($slug === '' || strlen($slug) < 3) {
            $slug = 'venue-'.Str::lower(Str::random(5));
        }

        // DNS label max is 63 chars; leave room for the uniqueness suffix.
        return Str::limit($slug, 40, '');
    }

    protected function unique(string $base): string
    {
        $slug = $base;
        $i = 1;

        while (! $this->isAvailable($slug)) {
            $slug = $base.'-'.(++$i);
        }

        return $slug;
    }
}
