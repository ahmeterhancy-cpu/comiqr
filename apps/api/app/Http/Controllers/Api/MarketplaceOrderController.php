<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderPlaced;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Branch;
use App\Models\Tenant;
use App\Services\LoyaltyService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Support\Plans\PlanGate;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Marketplace / menu package-service ordering (M20). Not bound to a table: the
 * guest orders a venue directly (by slug) for delivery or takeaway and pays at
 * the door (cod) or online (Tiko). Prices are server-side; card data never
 * reaches us (the online session is a Tiko form the browser posts).
 */
class MarketplaceOrderController extends Controller
{
    public function __construct(
        protected TenantManager $tenants,
        protected OrderService $orders,
        protected LoyaltyService $loyalty,
        protected PaymentService $payments,
    ) {}

    /** POST /venues/{slug}/orders */
    public function place(Request $request, string $slug): JsonResponse
    {
        $tenant = Tenant::where('slug', $slug)->whereIn('status', ['active', 'trialing'])->first();
        abort_if($tenant === null, 404, 'Venue not found.');
        $this->tenants->set($tenant);

        abort_unless(PlanGate::allows($tenant, 'ordering'), 402, 'Ordering is not available on this venue’s plan.');

        $data = $request->validate([
            'type' => ['required', 'in:delivery,takeaway'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'items.*.modifiers' => ['nullable', 'array'],
            'items.*.modifiers.*' => ['integer'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
            'contact.name' => ['required', 'string', 'max:120'],
            'contact.phone' => ['required', 'string', 'max:32'],
            'contact.address' => ['required_if:type,delivery', 'nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:500'],
            'payment_method' => ['required', 'in:cod,online'],
        ]);

        $branch = Branch::where('is_active', true)->orderBy('id')->first();
        abort_if($branch === null, 422, 'Venue has no active branch.');

        $customer = $this->loyalty->identify([
            'phone' => $data['contact']['phone'],
            'name' => $data['contact']['name'],
        ]);

        $order = $this->orders->placeDirect(
            $branch,
            $data['items'],
            $data['type'],
            [
                'name' => $data['contact']['name'],
                'phone' => $data['contact']['phone'],
                'address' => $data['contact']['address'] ?? null,
            ],
            $data['note'] ?? null,
            $customer,
        );

        OrderPlaced::dispatch($order);

        $session = null;
        if ($data['payment_method'] === 'online') {
            ['session' => $paymentSession] = $this->payments->initiate($order, 'tiko');
            $session = $paymentSession->toArray();
        }

        return response()->json(['data' => [
            'order' => new OrderResource($order->fresh('items')),
            'payment_method' => $data['payment_method'],
            'session' => $session,
        ]], 201);
    }
}
