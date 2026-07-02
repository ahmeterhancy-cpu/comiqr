<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterTenantRequest;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\TenantOnboardingService;
use App\Support\Auth\Totp;
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
     * Begin TOTP enrolment (M12, docs/06 §6.1). Generates a pending secret and
     * returns it plus an otpauth:// URI for the authenticator QR. The secret is
     * only trusted once confirmed with a valid code (see confirmTwoFactor).
     */
    public function enableTwoFactor(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_if(
            $user->two_factor_confirmed_at !== null,
            422,
            'Two-factor authentication is already enabled. Disable it first to re-enrol.',
        );

        $secret = Totp::generateSecret();
        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => null,
        ])->save();

        return response()->json(['data' => [
            'secret' => $secret,
            'otpauth_uri' => Totp::provisioningUri(
                $secret,
                $user->email,
                config('app.name', 'ComiQR'),
            ),
        ]]);
    }

    /** Confirm enrolment by verifying the first code, then activate 2FA. */
    public function confirmTwoFactor(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string']]);
        $user = $request->user();

        abort_if(empty($user->two_factor_secret), 422, 'Start two-factor enrolment first.');
        abort_if($user->two_factor_confirmed_at !== null, 422, 'Two-factor is already confirmed.');

        if (! Totp::verify($user->two_factor_secret, $request->input('code'))) {
            throw ValidationException::withMessages(['code' => ['Invalid verification code.']]);
        }

        $user->forceFill(['two_factor_confirmed_at' => now()])->save();

        return response()->json(['data' => ['two_factor_enabled' => true]]);
    }

    /**
     * Step-up verification for a confirmed account (docs/06 §6.1). Returns 422
     * when 2FA is not enabled, and a validation error for a wrong/expired code.
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

        if (! Totp::verify($user->two_factor_secret, $request->input('code'))) {
            throw ValidationException::withMessages(['code' => ['Invalid verification code.']]);
        }

        return response()->json(['data' => ['verified' => true]]);
    }

    /** Disable 2FA — requires a valid current code to prevent lock-in/hijack. */
    public function disableTwoFactor(Request $request): JsonResponse
    {
        $request->validate(['code' => ['required', 'string']]);
        $user = $request->user();

        abort_if($user->two_factor_confirmed_at === null, 422, 'Two-factor authentication is not enabled.');

        if (! Totp::verify($user->two_factor_secret, $request->input('code'))) {
            throw ValidationException::withMessages(['code' => ['Invalid verification code.']]);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        return response()->json(['data' => ['two_factor_enabled' => false]]);
    }

    protected function panelUrlFor(string $slug): string
    {
        $base = config('app.base_domain', 'comiqr.com');
        $scheme = str_contains($base, 'localhost') || str_contains($base, '.local') ? 'http' : 'https';

        return "{$scheme}://{$slug}.{$base}";
    }
}
