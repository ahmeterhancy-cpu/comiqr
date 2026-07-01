<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterTenantRequest;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\TenantOnboardingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Self-service tenant onboarding (docs/06 §6.1). Creates business + owner +
     * subdomain and returns an owner access token ready to enter an empty panel.
     */
    public function registerTenant(RegisterTenantRequest $request, TenantOnboardingService $onboarding): JsonResponse
    {
        ['tenant' => $tenant, 'owner' => $owner] = $onboarding->register(
            $request->validated(),
            $request->ip(),
        );

        $token = $owner->createToken($request->input('device_name', 'onboarding'))->plainTextToken;

        return response()->json([
            'data' => [
                'tenant' => new TenantResource($tenant),
                'user' => new UserResource($owner),
                'token' => $token,
                'panel_url' => $this->panelUrlFor($tenant->slug),
            ],
        ], 201);
    }

    /**
     * Panel/waiter/kitchen login → Sanctum token (docs/06 §6.1). Central endpoint:
     * the user is found by their globally-unique email, then all subsequent
     * requests are scoped to that user's tenant.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        // Explicitly bypass the tenant scope: at login no tenant is active yet.
        $user = User::withoutTenancy()->where('email', $request->input('email'))->first();

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => [__('auth.failed')],
            ]);
        }

        if ($user->tenant_id !== null) {
            $tenant = $user->tenant()->withTrashed()->first();

            if (! $tenant || $tenant->trashed() || $tenant->status === 'suspended') {
                throw ValidationException::withMessages([
                    'email' => [__('Your account is not active. Please contact support.')],
                ]);
            }
        }

        $token = $user->createToken($request->deviceName())->plainTextToken;

        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return response()->json([
            'data' => [
                'user' => new UserResource($user),
                'tenant' => $user->tenant_id ? new TenantResource($user->tenant()->with('plan')->first()) : null,
                'token' => $token,
            ],
        ]);
    }

    /** Revoke the token used for the current request. */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['data' => ['message' => 'Logged out.']]);
    }

    /** Current user + tenant (docs/06 §6.1). */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'user' => new UserResource($user),
                'tenant' => $user->tenant_id
                    ? new TenantResource($user->tenant()->with('plan')->first())
                    : null,
            ],
        ]);
    }

    /**
     * Two-factor verification (docs/06 §6.1). Full TOTP enrolment is a later
     * phase; until a user has a confirmed secret this reports 2FA as not enabled
     * rather than pretending to verify.
     */
    public function verifyTwoFactor(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string']]);

        $user = $request->user();

        if (empty($user->two_factor_secret) || $user->two_factor_confirmed_at === null) {
            return response()->json([
                'errors' => ['two_factor' => ['Two-factor authentication is not enabled for this account.']],
            ], 422);
        }

        // TODO(Faz 2): verify TOTP code against the decrypted secret.
        return response()->json([
            'errors' => ['two_factor' => ['Two-factor verification is not yet available.']],
        ], 501);
    }

    protected function panelUrlFor(string $slug): string
    {
        $base = config('app.base_domain', 'comiqr.com');
        $scheme = str_contains($base, 'localhost') || str_contains($base, '.local') ? 'http' : 'https';

        return "{$scheme}://{$slug}.{$base}";
    }
}
