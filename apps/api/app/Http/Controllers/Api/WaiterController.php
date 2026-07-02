<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderItemStatusChanged;
use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Table;
use App\Models\TableSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Waiter surface (M10, docs/06 §6.8). Auth (waiter+). Consumed by the Expo app
 * (or a web view); realtime deltas arrive over Reverb, this is the poll/source
 * of truth.
 */
class WaiterController extends Controller
{
    /** GET /waiter/tables — the floor board. */
    public function tables(Request $request): JsonResponse
    {
        $tables = Table::query()
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->where('is_active', true)
            ->with(['sessions' => fn ($q) => $q->where('status', 'open')])
            ->orderBy('code')
            ->get()
            ->map(function (Table $t) {
                $session = $t->sessions->first();
                $order = $session
                    ? \App\Models\Order::where('table_session_id', $session->id)->latest('placed_at')->first()
                    : null;

                return [
                    'table_id' => $t->id,
                    'code' => $t->code,
                    'state' => $session ? 'occupied' : 'free',
                    'session_id' => $session?->id,
                    'order_status' => $order?->status,
                    'payment_status' => $order?->payment_status,
                    'waiter_called' => (bool) $session?->waiter_called_at,
                    'bill_requested' => (bool) $session?->bill_requested_at,
                ];
            });

        return response()->json(['data' => $tables]);
    }

    /** GET /waiter/notifications — outstanding calls + items ready to serve. */
    public function notifications(): JsonResponse
    {
        $calls = TableSession::query()
            ->where('status', 'open')
            ->where(fn ($q) => $q->whereNotNull('waiter_called_at')->orWhereNotNull('bill_requested_at'))
            ->with('table:id,code')
            ->get()
            ->map(fn (TableSession $s) => [
                'session_id' => $s->id,
                'table_code' => $s->table?->code,
                'waiter_called' => (bool) $s->waiter_called_at,
                'bill_requested' => (bool) $s->bill_requested_at,
            ]);

        $ready = OrderItem::query()
            ->whereHas('order')
            ->where('status', 'ready')
            ->with('product:id,name')
            ->get()
            ->map(fn (OrderItem $i) => [
                'order_item_id' => $i->id,
                'order_id' => $i->order_id,
                'product' => $i->product?->name,
                'quantity' => $i->quantity,
            ]);

        return response()->json(['data' => ['service_calls' => $calls, 'ready_items' => $ready]]);
    }

    /** POST /waiter/order-items/{item}/served */
    public function served(string $item): JsonResponse
    {
        $orderItem = OrderItem::whereHas('order')->with('order')->find($item);
        abort_if($orderItem === null, 404, 'Order item not found.');

        $orderItem->update(['status' => 'served']);
        $order = $orderItem->order;
        $order->refreshStatusFromItems();

        OrderItemStatusChanged::dispatch($orderItem, $order->branch_id, $order->table_session_id);

        return response()->json(['data' => ['status' => 'served', 'order_status' => $order->fresh()->status]]);
    }

    /** POST /waiter/sessions/{session}/ack — clear service-call flags. */
    public function acknowledge(string $session): JsonResponse
    {
        $model = TableSession::findOrFail($session);
        $model->update(['waiter_called_at' => null, 'bill_requested_at' => null]);

        return response()->json(['data' => ['acknowledged' => true]]);
    }
}
