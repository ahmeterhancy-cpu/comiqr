<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\UpdateTenantRequest;
use App\Http\Resources\TenantResource;
use App\Models\AuditLog;
use App\Support\Tenancy\TenantManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    public function __construct(protected TenantManager $tenants) {}

    /** Active tenant settings (docs/06 §6.1). */
    public function show(): JsonResponse
    {
        abort_unless($this->tenants->check(), 403, 'No active tenant.');

        $tenant = $this->tenants->get()->loadMissing('plan');

        return response()->json(['data' => new TenantResource($tenant)]);
    }

    /** Update tenant settings / branding / locale (owner|manager). */
    public function update(UpdateTenantRequest $request): JsonResponse
    {
        abort_unless($this->tenants->check(), 403, 'No active tenant.');

        $tenant = $this->tenants->get();

        $data = $request->validated();

        // Merge settings_json rather than replacing the whole blob.
        if (array_key_exists('settings_json', $data)) {
            $data['settings_json'] = array_replace_recursive(
                $tenant->settings_json ?? [],
                $data['settings_json'],
            );
        }

        $tenant->fill($data)->save();

        AuditLog::create([
            'tenant_id' => $tenant->id,
            'user_id' => $request->user()->id,
            'action' => 'tenant.updated',
            'subject_type' => $tenant::class,
            'subject_id' => $tenant->id,
            'meta_json' => ['fields' => array_keys($data)],
            'ip' => $request->ip(),
        ]);

        return response()->json(['data' => new TenantResource($tenant->fresh('plan'))]);
    }
}
