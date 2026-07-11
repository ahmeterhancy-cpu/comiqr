<?php

namespace App\Console\Commands;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Enforce the failed-payment grace window: once a `past_due` subscription's
 * grace period is over, cancel it and downgrade the tenant to the Free plan
 * (paid features gate off, but the owner can still sign in and re-subscribe).
 * Runs daily (see routes/console.php).
 */
class EnforceSubscriptionGrace extends Command
{
    protected $signature = 'subscriptions:enforce-grace';

    protected $description = 'Ödemesi alınamayan (past_due) aboneliklerde ek süre dolduysa hesabı ücretsiz plana düşürür.';

    public function handle(): int
    {
        $free = Plan::where('code', 'free')->first();

        $subs = Subscription::withoutTenancy()
            ->where('status', 'past_due')
            ->whereNotNull('grace_ends_at')
            ->where('grace_ends_at', '<', now())
            ->get();

        $count = 0;
        foreach ($subs as $sub) {
            $sub->update(['status' => 'canceled']);

            if ($free) {
                Tenant::whereKey($sub->tenant_id)->update(['plan_id' => $free->id]);
            }

            Log::warning('subscription.grace_expired', [
                'tenant_id' => $sub->tenant_id,
                'subscription_id' => $sub->id,
                'downgraded_to' => $free?->code,
            ]);
            $count++;
        }

        $this->info("Ek süresi dolan {$count} abonelik iptal edildi / ücretsiz plana düşürüldü.");

        return self::SUCCESS;
    }
}
