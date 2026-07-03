<?php

namespace App\Http\Requests\Auth;

use App\Models\Plan;
use App\Support\Restaurant\RestaurantSettings;
use App\Support\Tenancy\SlugGenerator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public onboarding endpoint
    }

    public function rules(): array
    {
        return [
            'business_name' => ['required', 'string', 'min:2', 'max:255'],
            'owner_name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'confirmed', Password::defaults()],
            'phone' => ['nullable', 'string', 'max:32'],
            'slug' => [
                'nullable', 'string', 'min:3', 'max:40',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::notIn(SlugGenerator::RESERVED),
                Rule::unique('tenants', 'slug'),
            ],
            'locale' => ['nullable', 'string', Rule::in(['tr', 'en', 'de', 'ru', 'ar'])],
            'currency' => ['nullable', 'string', 'size:3'],
            'timezone' => ['nullable', 'timezone'],
            'plan' => ['nullable', 'string', Rule::exists('plans', 'code')],
            'vertical' => ['nullable', Rule::in(RestaurantSettings::VERTICALS)],
        ];
    }

    /** The chosen business type must be one the chosen plan unlocks (Faz 3). */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $vertical = $this->input('vertical');
            if (! $vertical || $vertical === 'restaurant') {
                return;
            }

            $plan = Plan::where('code', $this->input('plan', 'free'))->first();
            $allowed = $plan && is_array(data_get($plan->features_json, 'verticals'))
                ? data_get($plan->features_json, 'verticals')
                : ['restaurant'];

            if (! in_array($vertical, $allowed, true)) {
                $validator->errors()->add('vertical', 'Seçilen plan bu işletme türünü içermiyor.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'slug.regex' => 'The subdomain may only contain lowercase letters, numbers and hyphens.',
            'slug.not_in' => 'This subdomain is reserved.',
        ];
    }
}
