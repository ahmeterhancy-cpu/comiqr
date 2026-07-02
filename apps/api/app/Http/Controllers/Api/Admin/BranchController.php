<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\JsonResponse;

/**
 * Branch listing for the panel (used to scope KDS/analytics/tables).
 */
class BranchController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Branch::orderBy('id')->get(['id', 'name', 'is_active', 'lat', 'lng']),
        ]);
    }
}
