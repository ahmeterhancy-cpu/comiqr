<?php

namespace App\Support\Restaurant;

use Illuminate\Validation\Rule;

/**
 * Restaurant profile/settings stored in tenants.settings_json (Faz 2, M20).
 * Shared validation + defaults for the owner (self-serve) and superadmin
 * "manage restaurant" surfaces. Allow-flags default to true so a fresh venue
 * accepts everything until the owner narrows it down.
 */
class RestaurantSettings
{
    /** Validation rules for the settings_json.* fields (with the parent key). */
    public static function rules(): array
    {
        return [
            'settings_json.vertical' => ['sometimes', Rule::in(self::VERTICALS)],
            'settings_json.sub_title' => ['sometimes', 'nullable', 'string', 'max:120'],
            'settings_json.timing' => ['sometimes', 'nullable', 'string', 'max:120'],
            'settings_json.description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'settings_json.address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'settings_json.allow_call_waiter' => ['sometimes', 'boolean'],
            'settings_json.allow_on_table_order' => ['sometimes', 'boolean'],
            'settings_json.allow_takeaway' => ['sometimes', 'boolean'],
            'settings_json.allow_delivery' => ['sometimes', 'boolean'],
            'settings_json.delivery_charge' => ['sometimes', 'numeric', 'min:0'],
            'settings_json.order_notification' => ['sometimes', 'boolean'],
            'settings_json.allow_online_payment' => ['sometimes', 'boolean'],
            'settings_json.theme' => ['sometimes', Rule::in(self::THEMES)],
            'settings_json.logo' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings_json.cover' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ];
    }

    public const THEMES = ['classic', 'flipbook', 'modern'];

    /** Business verticals (Faz 3). Restaurant is the default behaviour. */
    public const VERTICALS = ['restaurant', 'hotel', 'bar'];

    /** Is a feature allowed for this settings blob (missing → allowed)? */
    public static function allows(?array $settings, string $key): bool
    {
        return (bool) ($settings[$key] ?? true);
    }

    /** The tenant's business vertical (missing → restaurant). */
    public static function vertical(?array $settings): string
    {
        $v = $settings['vertical'] ?? 'restaurant';

        return in_array($v, self::VERTICALS, true) ? $v : 'restaurant';
    }

    public static function isHotel(?array $settings): bool
    {
        return self::vertical($settings) === 'hotel';
    }

    public static function deliveryCharge(?array $settings): float
    {
        return (float) ($settings['delivery_charge'] ?? 0);
    }
}
