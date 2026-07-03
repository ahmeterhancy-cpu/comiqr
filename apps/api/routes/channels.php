<?php

use App\Models\User;
use App\Support\Broadcast\ChannelAuth;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast channel authorization (M6/M10, docs/04 §4.4). Live order/KDS/waiter
| feeds are per-branch private channels; only staff of the branch's tenant may
| subscribe. Auth runs through /v1/broadcasting/auth with the Sanctum guard.
|--------------------------------------------------------------------------
*/

Broadcast::channel('branch.{branchId}.{feed}', function (User $user, $branchId, $feed) {
    return ChannelAuth::canJoinBranch($user, (int) $branchId, (string) $feed);
});
