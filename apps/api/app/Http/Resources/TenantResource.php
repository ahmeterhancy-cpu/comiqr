<?php

namespace App\Http\Resources;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Tenant */
class TenantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'custom_domain' => $this->custom_domain,
            'status' => $this->status,
            'locale_default' => $this->locale_default,
            'currency' => $this->currency,
            'timezone' => $this->timezone,
            'settings' => $this->settings_json ?? [],
            'trial_ends_at' => $this->trial_ends_at,
            'plan' => $this->whenLoaded('plan', fn () => [
                'code' => $this->plan?->code,
                'name' => $this->plan?->name,
                'features' => $this->plan?->features_json ?? [],
                'limits' => $this->plan?->limits_json ?? [],
            ]),
            'created_at' => $this->created_at,
        ];
    }
}
