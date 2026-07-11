<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\UpdateTenantRequest;
use App\Http\Resources\TenantResource;
use App\Models\AuditLog;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    /** Active tenant settings (docs/06 §6.1). */
    public function show(): JsonResponse
    {
        abort_unless($this->tenants->check(), 403, 'No active tenant.');

        $tenant = $this->tenants->get()->loadMissing('plan');

        return response()->json(['data' => new TenantResource($tenant)]);
    }

    /** Update tenant settings / branding / locale (owner|manager). */
    public function update(UpdateTenantRequest $request): JsonResponse
    {
        abort_unless($this->tenants->check(), 403, 'No active tenant.');

        $tenant = $this->tenants->get();

        $data = $request->validated();

        // Merge settings_json rather than replacing the whole blob.
        if (array_key_exists('settings_json', $data)) {
            $data['settings_json'] = array_replace_recursive(
                $tenant->settings_json ?? [],
                $data['settings_json'],
            );
        }

        $tenant->fill($data)->save();

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'tenant.updated',
            'subject_type' => $tenant::class,
            'subject_id' => $tenant->id,
            'meta_json' => ['fields' => array_keys($data)],
            'ip' => $request->ip(),
        ]);

        return response()->json(['data' => new TenantResource($tenant->fresh('plan'))]);
    }

    /**
     * POST /tenant/region — set the tenant's regional settings (currency, timezone,
     * default locale) from a country. Used by the post-signup onboarding step.
     */
    public function region(Request $request): JsonResponse
    {
        abort_unless($this->tenants->check(), 403, 'No active tenant.');

        $data = $request->validate(['country' => ['required', 'string', 'size:2']]);
        $code = strtoupper($data['country']);
        [$currency, $tz, $locale] = \App\Support\Geo\Countries::region($code);

        $tenant = $this->tenants->get();
        $settings = $tenant->settings_json ?? [];
        $settings['country'] = $code;

        $tenant->update([
            'currency' => $currency,
            'timezone' => $tz,
            'locale_default' => $locale,
            'settings_json' => $settings,
        ]);

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'tenant.region_set',
            'subject_type' => $tenant::class,
            'subject_id' => $tenant->id,
            'meta_json' => ['country' => $code, 'currency' => $currency, 'timezone' => $tz],
            'ip' => $request->ip(),
        ]);

        return response()->json(['data' => ['country' => $code, 'currency' => $currency, 'timezone' => $tz, 'locale' => $locale]]);
    }
}
