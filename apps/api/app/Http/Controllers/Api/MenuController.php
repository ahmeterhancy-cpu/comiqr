<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\ResolvesQrToken;
use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Models\Allergen;
use App\Models\Branch;
use App\Models\Category;
use App\Models\EightySixItem;
use App\Models\MenuView;
use App\Models\Table;
use App\Models\Tenant;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public menu (M1/M4, docs/06 §6.2). Two entry points:
 *  - GET /menu           tenant from host / X-Tenant / ?tenant= (`tenant` middleware)
 *  - GET /menu/{qrToken} tenant + table resolved from the scanned QR token (M3)
 * Reads the cached nutrition summary — never a live calculation (docs/03 §3.3).
 */
class MenuController extends Controller
{
    use ResolvesQrToken;

    public function __construct(
        protected TenantManager $tenants,
        protected \App\Services\ReviewService $reviews,
        protected \App\Services\AiService $ai,
    ) {}

    /**
     * POST /menu/chat — guest-facing AI menu assistant. Tenant resolved by the
     * `tenant` middleware. Gated behind the tenant's `ai` plan feature; 503 when
     * no AI provider is configured. Answers strictly from the menu (no ordering).
     */
    public function chat(Request $request): JsonResponse
    {
        $tenant = $this->tenants->get();

        abort_unless(\App\Support\Plans\PlanGate::allows($tenant, 'ai'), 402, 'AI menü asistanı bu planda kapalı.');
        abort_unless($this->ai->isConfigured(), 503, 'AI şu an yapılandırılmamış.');

        $data = $request->validate([
            'question' => ['required', 'string', 'max:500'],
            'locale' => ['sometimes', 'string', 'max:8'],
            'history' => ['sometimes', 'array', 'max:10'],
            'history.*.role' => ['required', 'string', 'in:user,assistant'],
            'history.*.content' => ['required', 'string', 'max:1500'],
        ]);

        $branchId = Branch::query()->where('is_active', true)->orderBy('id')->value('id');
        $locale = $data['locale'] ?? $tenant->locale_default ?? config('app.locale');
        app()->setLocale($locale);

        $answer = $this->ai->menuChat(
            $this->chatContext($tenant, $branchId),
            $data['question'],
            $locale,
            $data['history'] ?? [],
        );

        return response()->json(['data' => ['answer' => $answer]]);
    }

    /** Compact, token-efficient menu context for the guest chatbot (no cost/margin). */
    protected function chatContext(Tenant $tenant, ?int $branchId): array
    {
        $menu = $this->buildMenu($tenant, $branchId);
        $venue = $menu['venue'];
        $allergenNames = collect($menu['allergens'])->keyBy('id')->map(fn ($a) => $a['name']);

        $categories = collect($menu['categories'])->map(fn ($c) => [
            'category' => $c['name'],
            'items' => collect($c['products'] ?? [])->map(function ($p) use ($allergenNames) {
                $variants = collect($p['variants'] ?? [])->map(fn ($v) => [
                    'name' => $v['name'],
                    'price' => round((float) $p['price'] + (float) ($v['price_delta'] ?? 0), 2),
                ])->values();
                $n = $p['nutrition'] ?? null;

                return array_filter([
                    'name' => $p['name'],
                    'price' => $variants->isEmpty() ? $p['price'] : null,
                    'variants' => $variants->isEmpty() ? null : $variants->all(),
                    'description' => $p['description'] ?? null,
                    'kcal' => $n['kcal'] ?? null,
                    'allergens' => $n
                        ? collect($n['allergens']['contains'] ?? [])->map(fn ($id) => $allergenNames[$id] ?? null)->filter()->values()->all()
                        : null,
                    'diet' => $n['diet'] ?? null,
                    'age_restricted' => ! empty($p['age_restricted']) ? true : null,
                ], fn ($v) => $v !== null && $v !== []);
            })->values()->all(),
        ])->values()->all();

        return [
            'venue' => array_filter([
                'name' => $venue['name'],
                'hours' => $venue['timing'] ?? null,
                'address' => $venue['address'] ?? null,
                'about' => $venue['description'] ?? null,
                'currency' => $venue['currency'],
                'happy_hour_percent' => ($venue['happy_hour']['active'] ?? false) ? $venue['happy_hour']['percent'] : null,
            ], fn ($v) => $v !== null),
            'menu' => $categories,
        ];
    }

    /** POST /menu/{qrToken}/view — record a menu/product impression (M9). */
    public function logView(Request $request, string $qrToken): JsonResponse
    {
        [$table] = $this->resolveByToken($qrToken);

        $productId = $request->integer('product_id') ?: null;
        if ($productId && ! \App\Models\Product::whereKey($productId)->exists()) {
            $productId = null;
        }

        MenuView::create([
            'branch_id' => $table->branch_id,
            'product_id' => $productId,
            'locale' => $request->query('locale'),
            'viewed_at' => now(),
        ]);

        return response()->json(['data' => ['logged' => true]]);
    }

    /** Tenant already resolved by the `tenant` middleware. */
    public function show(): JsonResponse
    {
        $tenant = $this->tenants->get();
        $branchId = Branch::query()->where('is_active', true)->orderBy('id')->value('id');

        return response()->json(['data' => $this->buildMenu($tenant, $branchId)]);
    }

    /** QR-token entry: resolve the venue + table from an unguessable token. */
    public function showByToken(string $qrToken): JsonResponse
    {
        $table = Table::withoutTenancy()
            ->where('qr_token', $qrToken)
            ->where('is_active', true)
            ->first();

        abort_if($table === null, 404, 'Menu not found.');

        $tenant = Tenant::find($table->tenant_id);
        abort_if($tenant === null || $tenant->status === 'suspended', 404, 'Menu not found.');

        $this->tenants->set($tenant);
        app()->setLocale(request()->query('locale', $tenant->locale_default ?? config('app.locale')));

        $table->loadMissing('diningArea');

        $data = $this->buildMenu($tenant, $table->branch_id);
        $data['table'] = [
            'id' => $table->id,
            'code' => $table->code,
            'qr_token' => $table->qr_token,
            'area_type' => $table->diningArea?->type,
            'is_room' => $table->diningArea?->type === 'room',
        ];

        return response()->json(['data' => $data]);
    }

    /** @return array<string,mixed> */
    protected function buildMenu(Tenant $tenant, ?int $branchId = null): array
    {
        // Products 86'd for this branch are hidden from the menu (docs/06 §6.7).
        $eightySixed = $branchId ? EightySixItem::activeProductIds($branchId) : [];

        $categories = Category::query()
            ->where('is_active', true)
            ->whereNull('parent_id')
            ->with([
                'translations',
                'products' => fn ($q) => $q->where('is_active', true)
                    ->when($eightySixed, fn ($qq) => $qq->whereNotIn('id', $eightySixed))
                    ->orderBy('sort'),
                'products.translations',
                'products.variants',
                'products.modifierGroups.modifiers',
                'products.nutritionSummary',
            ])
            ->orderBy('sort')
            ->get();

        $settings = $tenant->settings_json ?? [];
        $rep = $this->reviews->reputation($tenant->id);
        // White-label branding only takes effect on plans that unlock it (Faz 3).
        $whiteLabel = \App\Support\Plans\PlanGate::allows($tenant, 'white_label');

        return [
            'venue' => [
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'rating' => $rep['average'],
                'reviews_count' => $rep['count'],
                'brand_color' => $whiteLabel ? ($settings['brand_color'] ?? null) : null,
                'powered_by' => ! ($whiteLabel && ($settings['hide_powered_by'] ?? false)),
                'locale_default' => $tenant->locale_default,
                'currency' => $tenant->currency,
                'sub_title' => $settings['sub_title'] ?? null,
                'timing' => $settings['timing'] ?? null,
                'hours' => self::weekHours($settings, $tenant->timezone),
                'open_now' => self::openNowFromHours($settings, $tenant->timezone)
                    ?? self::openNow($settings['timing'] ?? null, $tenant->timezone),
                'description' => $settings['description'] ?? null,
                'address' => $settings['address'] ?? null,
                'logo' => $settings['logo'] ?? null,
                'cover' => $settings['cover'] ?? null,
                // Contact + social + guest WiFi (all live in settings_json; shown only when set).
                'email' => $settings['email'] ?? null,
                'website' => $settings['website'] ?? null,
                'phone' => $settings['phone'] ?? null,
                'instagram' => $settings['instagram'] ?? null,
                'facebook' => $settings['facebook'] ?? null,
                'x' => $settings['x'] ?? null,
                'tiktok' => $settings['tiktok'] ?? null,
                'youtube' => $settings['youtube'] ?? null,
                'whatsapp' => $settings['whatsapp'] ?? null,
                'wifi_ssid' => $settings['wifi_ssid'] ?? null,
                'wifi_password' => $settings['wifi_password'] ?? null,
                'theme' => $settings['theme'] ?? 'classic',
                // Guest AI chatbot is offered only when the plan unlocks AI and a provider is configured.
                'ai_chat' => \App\Support\Plans\PlanGate::allows($tenant, 'ai') && $this->ai->isConfigured(),
                'vertical' => \App\Support\Restaurant\RestaurantSettings::vertical($settings),
                'happy_hour' => [
                    'active' => \App\Support\Restaurant\HappyHour::active($settings, null, $tenant->timezone),
                    'percent' => \App\Support\Restaurant\HappyHour::percent($settings, null, $tenant->timezone),
                ],
            ],
            'allergens' => Allergen::orderBy('id')->get(['id', 'code', 'name', 'icon']),
            'categories' => CategoryResource::collection($categories)->resolve(),
        ];
    }

    /**
     * Is the venue open right now, based on the free-text working-hours string
     * (e.g. "11:00 - 23:00") evaluated in the tenant's timezone? Handles overnight
     * ranges (22:00 - 02:00). Returns null when the string can't be parsed.
     */
    private static function openNow(?string $timing, ?string $tz): ?bool
    {
        if (! $timing || ! preg_match('/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/u', $timing, $m)) {
            return null;
        }

        try {
            $now = \Illuminate\Support\Carbon::now($tz ?: config('app.timezone'));
            $cur = $now->hour * 60 + $now->minute;
            [$sh, $sm] = array_map('intval', explode(':', $m[1]));
            [$eh, $em] = array_map('intval', explode(':', $m[2]));
            $start = $sh * 60 + $sm;
            $end = $eh * 60 + $em;

            if ($start === $end) {
                return null; // 24h or ambiguous — don't guess
            }

            return $end > $start
                ? ($cur >= $start && $cur < $end)
                : ($cur >= $start || $cur < $end); // overnight window
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Normalise the per-day working hours (index 0=Mon..6=Sun) for the venue payload,
     * marking the current day in the tenant's timezone. Returns null when unconfigured.
     */
    private static function weekHours(?array $settings, ?string $tz): ?array
    {
        $raw = $settings['hours'] ?? null;
        if (! is_array($raw) || count($raw) === 0) {
            return null;
        }

        try {
            $todayIdx = (int) \Illuminate\Support\Carbon::now($tz ?: config('app.timezone'))->dayOfWeekIso - 1;
        } catch (\Throwable) {
            $todayIdx = -1;
        }

        $out = [];
        for ($i = 0; $i < 7; $i++) {
            $d = is_array($raw[$i] ?? null) ? $raw[$i] : [];
            $closed = (bool) ($d['closed'] ?? false);
            $out[] = [
                'closed' => $closed,
                'open' => $closed ? null : ($d['open'] ?? null),
                'close' => $closed ? null : ($d['close'] ?? null),
                'today' => $i === $todayIdx,
            ];
        }

        return $out;
    }

    /**
     * Open/closed right now from the structured per-day `hours`, accounting for
     * overnight windows that spill from the previous day. Null when unconfigured.
     */
    private static function openNowFromHours(?array $settings, ?string $tz): ?bool
    {
        $raw = $settings['hours'] ?? null;
        if (! is_array($raw) || count($raw) === 0) {
            return null;
        }

        try {
            $now = \Illuminate\Support\Carbon::now($tz ?: config('app.timezone'));
            $cur = $now->hour * 60 + $now->minute;
            $todayIdx = (int) $now->dayOfWeekIso - 1;
            $yestIdx = ($todayIdx + 6) % 7;

            // eveningOnly=false → normal/evening part of the day; eveningOnly=true → morning spill of an overnight window.
            $inWindow = static function ($d, int $cur, bool $morningSpill): bool {
                if (! is_array($d) || ($d['closed'] ?? false)) {
                    return false;
                }
                $o = self::toMinutes($d['open'] ?? null);
                $c = self::toMinutes($d['close'] ?? null);
                if ($o === null || $c === null || $o === $c) {
                    return false;
                }
                if ($c > $o) {
                    return ! $morningSpill && $cur >= $o && $cur < $c;
                }

                // overnight (close < open): [open, 24:00) today, [00:00, close) next morning
                return $morningSpill ? ($cur < $c) : ($cur >= $o);
            };

            return $inWindow($raw[$todayIdx] ?? null, $cur, false)
                || $inWindow($raw[$yestIdx] ?? null, $cur, true);
        } catch (\Throwable) {
            return null;
        }
    }

    private static function toMinutes(?string $t): ?int
    {
        if (! $t || ! preg_match('/^(\d{1,2}):(\d{2})$/', $t, $m)) {
            return null;
        }

        return ((int) $m[1]) * 60 + ((int) $m[2]);
    }
}
