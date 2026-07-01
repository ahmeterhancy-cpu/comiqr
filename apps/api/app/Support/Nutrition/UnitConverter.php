<?php

namespace App\Support\Nutrition;

use InvalidArgumentException;

/**
 * Unit conversion for the nutrition/cost engine (docs/03 §3.3). Three families:
 * mass (canonical gram), volume (canonical millilitre), count (canonical adet).
 * Cross-family conversion is a hard error so a recipe can't mix g with ml.
 */
final class UnitConverter
{
    /** unit => [family, factor-to-canonical] */
    private const UNITS = [
        'mg' => ['mass', 0.001],
        'g' => ['mass', 1.0],
        'gr' => ['mass', 1.0],
        'kg' => ['mass', 1000.0],
        'ml' => ['volume', 1.0],
        'cl' => ['volume', 10.0],
        'l' => ['volume', 1000.0],
        'lt' => ['volume', 1000.0],
        'adet' => ['count', 1.0],
        'piece' => ['count', 1.0],
    ];

    public static function family(string $unit): string
    {
        $u = strtolower(trim($unit));
        if (! isset(self::UNITS[$u])) {
            throw new InvalidArgumentException("Unknown unit: {$unit}");
        }

        return self::UNITS[$u][0];
    }

    public static function sameFamily(string $a, string $b): bool
    {
        return self::family($a) === self::family($b);
    }

    /** Convert a quantity to the canonical unit of its family (g / ml / adet). */
    public static function toCanonical(float $quantity, string $unit): float
    {
        $u = strtolower(trim($unit));
        if (! isset(self::UNITS[$u])) {
            throw new InvalidArgumentException("Unknown unit: {$unit}");
        }

        return $quantity * self::UNITS[$u][1];
    }

    /** Convert a canonical-unit quantity into $targetUnit (same family required). */
    public static function fromCanonical(float $canonicalQty, string $targetUnit): float
    {
        $u = strtolower(trim($targetUnit));
        if (! isset(self::UNITS[$u])) {
            throw new InvalidArgumentException("Unknown unit: {$targetUnit}");
        }

        return $canonicalQty / self::UNITS[$u][1];
    }
}
