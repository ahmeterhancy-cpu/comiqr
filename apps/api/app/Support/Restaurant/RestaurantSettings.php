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
            // Contact + social links + guest WiFi (shown on the public menu when set).
            'settings_json.email' => ['sometimes', 'nullable', 'string', 'max:200'],
            'settings_json.website' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings_json.phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'settings_json.instagram' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings_json.facebook' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings_json.x' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings_json.tiktok' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings_json.youtube' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings_json.whatsapp' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'settings_json.wifi_ssid' => ['sometimes', 'nullable', 'string', 'max:120'],
            'settings_json.wifi_password' => ['sometimes', 'nullable', 'string', 'max:120'],
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
            // White-label (Faz 3) — only applied when the plan unlocks `white_label`.
            'settings_json.brand_color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'settings_json.hide_powered_by' => ['sometimes', 'boolean'],
            // Bar vertical — happy-hour discount window.
            'settings_json.happy_hour' => ['sometimes', 'nullable', 'array'],
            'settings_json.happy_hour.enabled' => ['sometimes', 'boolean'],
            'settings_json.happy_hour.start' => ['sometimes', 'nullable', 'date_format:H:i'],
            'settings_json.happy_hour.end' => ['sometimes', 'nullable', 'date_format:H:i'],
            'settings_json.happy_hour.percent' => ['sometimes', 'numeric', 'min:0', 'max:90'],
        ];
    }

    public const THEMES = ['classic', 'flipbook', 'modern'];

    /** Business verticals (Faz 3). Restaurant is the default behaviour. */
    public const VERTICALS = ['restaurant', 'hotel', 'bar', 'beach'];

    /** Dining-area types that support a deferred "charge to folio" (room / sunbed). */
    public const FOLIO_AREA_TYPES = ['room', 'sunbed'];

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

    /**
     * Verticals that defer payment onto a folio settled at check-out — a hotel's
     * rooms or a beach club's sunbeds. Restaurant/bar collect per order.
     */
    public static function foliosEnabled(?array $settings): bool
    {
        return in_array(self::vertical($settings), ['hotel', 'beach'], true);
    }

    public static function deliveryCharge(?array $settings): float
    {
        return (float) ($settings['delivery_charge'] ?? 0);
    }
}
