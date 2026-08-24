<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\SlugGenerator;
use App\Support\Tenancy\TenantManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Self-service onboarding (docs/07 Faz 0, docs/06 §6.1): a business registers,
 * gets a subdomain and a ready-to-use empty panel in one atomic step.
 *
 * Creates: tenant → default branch → owner user → free subscription, plus an
 * audit entry. Tenant-scoped rows are written inside TenantManager::runAs so the
 * global scope auto-fills tenant_id correctly.
 */
class TenantOnboardingService
{
    /** Ücretsiz deneme süresi (gün). Pazarlama sayfası ve sözleşme metni bununla aynı olmalı. */
    public const TRIAL_DAYS = 30;

    public function __construct(
        protected SlugGenerator $slugs,
        protected TenantManager $tenants,
    ) {}

    /**
     * @param  array{business_name:string,owner_name:string,email:string,password:string,phone?:string,slug?:string,locale?:string,currency?:string,timezone?:string,plan?:string,vertical?:string}  $data
     * @return array{tenant: Tenant, owner: User}
     */
    public function register(array $data, ?string $ip = null): array
    {
        $slug = isset($data['slug']) && $data['slug'] !== ''
            ? $this->slugs->fromDesired($data['slug'])
            : $this->slugs->fromName($data['business_name']);

        // The business picks a plan + vertical at sign-up; default to Free/restaurant.
        $plan = Plan::query()->where('code', $data['plan'] ?? 'free')->first()
            ?? Plan::query()->where('code', 'free')->first();

        $allowed = is_array(data_get($plan?->features_json, 'verticals'))
            ? data_get($plan->features_json, 'verticals')
            : ['restaurant'];
        $vertical = in_array($data['vertical'] ?? 'restaurant', $allowed, true)
            ? ($data['vertical'] ?? 'restaurant')
            : 'restaurant';

        return DB::transaction(function () use ($data, $slug, $plan, $vertical, $ip) {
            $tenant = Tenant::create([
                'name' => $data['business_name'],
                'slug' => $slug,
                'plan_id' => $plan?->id,
                'status' => 'trialing',
                'locale_default' => $data['locale'] ?? config('app.locale', 'tr'),
                'currency' => $data['currency'] ?? 'EUR',
                'timezone' => $data['timezone'] ?? 'Asia/Nicosia',
                'settings_json' => ['vertical' => $vertical],
                'trial_ends_at' => now()->addDays(self::TRIAL_DAYS),
            ]);

            [$owner, $branch] = $this->tenants->runAs($tenant, function () use ($tenant, $data, $plan) {
                $branch = Branch::create([
                    'name' => $data['business_name'],
                    'timezone' => $tenant->timezone,
                    'is_active' => true,
                ]);

                $owner = User::create([
                    'name' => $data['owner_name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? null,
                    'password' => Hash::make($data['password']),
                    'role' => Role::Owner,
                    'email_verified_at' => now(),
                ]);

                if ($plan) {
                    Subscription::create([
                        'plan_id' => $plan->id,
                        'status' => 'trialing',
                        'billing_cycle' => 'monthly',
                        'current_period_end' => $tenant->trial_ends_at,
                    ]);
                }

                return [$owner, $branch];
            });

            AuditLog::create([
                'tenant_id' => $tenant->id,
                'user_id' => $owner->id,
                'action' => 'tenant.registered',
                'subject_type' => Tenant::class,
                'subject_id' => $tenant->id,
                'meta_json' => ['slug' => $tenant->slug, 'branch_id' => $branch->id],
                'ip' => $ip,
            ]);

            return ['tenant' => $tenant->fresh('plan'), 'owner' => $owner];
        });
    }
}
