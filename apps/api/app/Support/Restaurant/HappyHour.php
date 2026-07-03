<?php

namespace App\Support\Restaurant;

use Carbon\CarbonInterface;

/**
 * Bar vertical (Faz 3): a time-boxed happy-hour discount applied server-side to
 * every order placed within the window. Stored in settings_json.happy_hour =
 * { enabled, start:"HH:MM", end:"HH:MM", percent }. Windows may wrap past
 * midnight (e.g. 22:00–02:00). Compared in the app timezone (KKTC).
 */
class HappyHour
{
    /**
     * Active discount percent (0 when not a bar, disabled, or outside the window).
     * The window is compared in the tenant's own timezone ($tz), falling back to
     * the app timezone; tests may inject a fixed $now.
     */
    public static function percent(?array $settings, ?CarbonInterface $now = null, ?string $tz = null): float
    {
        // Happy hour is a bar-vertical feature only — never discount other verticals.
        if (RestaurantSettings::vertical($settings) !== 'bar') {
            return 0.0;
        }

        $hh = $settings['happy_hour'] ?? null;
        if (! is_array($hh) || empty($hh['enabled'])) {
            return 0.0;
        }

        $percent = (float) ($hh['percent'] ?? 0);
        $start = $hh['start'] ?? null;
        $end = $hh['end'] ?? null;
        if ($percent <= 0 || ! self::validTime($start) || ! self::validTime($end) || $start === $end) {
            return 0.0;
        }

        $cur = ($now ?? now($tz))->format('H:i');
        $active = $start < $end
            ? ($cur >= $start && $cur < $end)
            : ($cur >= $start || $cur < $end); // window wraps past midnight

        return $active ? min(90.0, $percent) : 0.0;
    }

    public static function active(?array $settings, ?CarbonInterface $now = null, ?string $tz = null): bool
    {
        return self::percent($settings, $now, $tz) > 0;
    }

    private static function validTime(mixed $v): bool
    {
        return is_string($v) && preg_match('/^\d{2}:\d{2}$/', $v) === 1;
    }
}
