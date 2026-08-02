<?php

namespace App\Support\Restaurant;

use App\Models\Product;

/**
 * VAT handling (Faz 4 — Rapor Kokpiti).
 *
 * Menu prices in TR/KKTC venues are VAT-INCLUSIVE: the guest pays the shelf
 * price. The rate therefore only decides how that price is SPLIT for reporting —
 * applying a rate never changes what anyone is charged.
 *
 *     vat  = gross × rate / (100 + rate)
 *     net  = gross − vat
 */
class Vat
{
    /** Used when neither the product nor the tenant sets a rate. */
    public const DEFAULT_RATE = 0.0;

    /** The tenant-wide default rate from settings_json. */
    public static function tenantRate(?array $settings): float
    {
        return round((float) ($settings['vat_rate'] ?? self::DEFAULT_RATE), 2);
    }

    /** A product's own rate, falling back to the tenant default. */
    public static function rateFor(Product $product, ?array $settings): float
    {
        $own = $product->vat_rate;

        return $own !== null ? round((float) $own, 2) : self::tenantRate($settings);
    }

    /** The tax hidden inside a VAT-inclusive amount. */
    public static function extract(float $gross, float $rate): float
    {
        if ($rate <= 0) {
            return 0.0;
        }

        return round($gross * $rate / (100 + $rate), 2);
    }

    /** The amount net of the VAT hidden inside it. */
    public static function net(float $gross, float $rate): float
    {
        return round($gross - self::extract($gross, $rate), 2);
    }
}
