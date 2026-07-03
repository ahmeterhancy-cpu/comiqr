<?php

namespace App\Http\Requests\Tenant;

use App\Enums\Role;
use App\Support\Restaurant\RestaurantSettings;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        return $user !== null && $user->role?->satisfiesAny([Role::Manager->value]);
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'locale_default' => ['sometimes', 'string', Rule::in(['tr', 'en', 'de', 'ru', 'ar'])],
            'currency' => ['sometimes', 'string', 'size:3'],
            'timezone' => ['sometimes', 'timezone'],
            'settings_json' => ['sometimes', 'array'],
            'settings_json.branding' => ['sometimes', 'array'],
            ...RestaurantSettings::rules(),
        ];
    }

    /** An owner may only switch to a vertical their plan unlocks (Faz 3). */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $vertical = data_get($this->input('settings_json'), 'vertical');
            if (! $vertical || $vertical === 'restaurant') {
                return;
            }

            $tenant = app(\App\Support\Tenancy\TenantManager::class)->get();
            if ($tenant && ! \App\Support\Plans\PlanGate::allowsVertical($tenant, $vertical)) {
                $validator->errors()->add('settings_json.vertical', 'Planınız bu işletme türünü içermiyor.');
            }
        });
    }
}
