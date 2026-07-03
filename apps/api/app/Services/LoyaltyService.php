<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\LoyaltyAccount;
use App\Models\LoyaltyTransaction;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

/**
 * Loyalty & customer identity (Faz 2, M8, docs/05 §5.7). Customers are optional
 * and identified by phone; points are earned once per paid order and redeemable.
 */
class LoyaltyService
{
    /** Points earned per unit of currency spent (e.g. 0.1 = 1 point / 10 TRY). */
    public const EARN_RATE = 0.1;

    /**
     * Find-or-create a customer by phone and ensure a loyalty account exists.
     *
     * @param  array{phone?:string,name?:string,email?:string,locale?:string}  $data
     */
    public function identify(array $data): ?Customer
    {
        $phone = trim($data['phone'] ?? '');
        if ($phone === '') {
            return null;
        }

        $hash = Customer::hashPhone($phone);

        $customer = Customer::where('phone_hash', $hash)->first();
        if (! $customer) {
            $customer = Customer::create([
                'phone' => Customer::normalizePhone($phone),
                'phone_hash' => $hash,
                'name' => $data['name'] ?? null,
                'email' => $data['email'] ?? null,
                'locale' => $data['locale'] ?? null,
                'consent_json' => ['loyalty' => true, 'at' => now()->toIso8601String()],
                'first_seen_at' => now(),
                'last_seen_at' => now(),
            ]);
        } else {
            $customer->update(array_filter([
                'name' => $data['name'] ?? null,
                'last_seen_at' => now(),
            ]));
        }

        LoyaltyAccount::firstOrCreate(['customer_id' => $customer->id], ['tenant_id' => $customer->tenant_id]);

        return $customer;
    }

    /** Earn points for a paid order (idempotent per order). */
    public function earnForOrder(Order $order): ?LoyaltyTransaction
    {
        if (! $order->customer_id) {
            return null;
        }

        $account = LoyaltyAccount::where('customer_id', $order->customer_id)->first();
        if (! $account) {
            return null;
        }

        $already = LoyaltyTransaction::where('loyalty_account_id', $account->id)
            ->where('order_id', $order->id)
            ->where('type', 'earn')
            ->exists();
        if ($already) {
            return null;
        }

        $points = (int) floor((float) $order->grand_total * self::EARN_RATE);
        if ($points <= 0) {
            return null;
        }

        return DB::transaction(function () use ($account, $order, $points) {
            $account->increment('points_balance', $points);
            $order->customer?->increment('total_orders');
            $order->customer?->increment('total_spend', (float) $order->grand_total);

            return LoyaltyTransaction::create([
                'loyalty_account_id' => $account->id,
                'type' => 'earn',
                'points' => $points,
                'order_id' => $order->id,
                'created_at' => now(),
            ]);
        });
    }

    /** Bonus points for leaving a review (Faz 3). Called once per order review. */
    public function awardReviewPoints(Customer $customer, int $orderId, int $points = 20): ?LoyaltyTransaction
    {
        $account = LoyaltyAccount::where('customer_id', $customer->id)->first();
        if (! $account || $points <= 0) {
            return null;
        }

        return DB::transaction(function () use ($account, $orderId, $points) {
            $account->increment('points_balance', $points);

            return LoyaltyTransaction::create([
                'loyalty_account_id' => $account->id,
                'type' => 'earn',
                'points' => $points,
                'order_id' => $orderId,
                'meta_json' => ['reason' => 'review'],
                'created_at' => now(),
            ]);
        });
    }

    /** Redeem points; returns false if the balance is insufficient. */
    public function redeem(LoyaltyAccount $account, int $points, ?int $orderId = null): bool
    {
        if ($points <= 0 || $account->points_balance < $points) {
            return false;
        }

        DB::transaction(function () use ($account, $points, $orderId) {
            $account->decrement('points_balance', $points);
            LoyaltyTransaction::create([
                'loyalty_account_id' => $account->id,
                'type' => 'redeem',
                'points' => -$points,
                'order_id' => $orderId,
                'created_at' => now(),
            ]);
        });

        return true;
    }
}
