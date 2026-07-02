'use client';

import { useState } from 'react';
import { Panel } from '@/components/superadmin-ui';
import { Button, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export default function SettingsPage() {
  const { api, me } = useApi();
  const enabled = !!me?.user.two_factor_enabled;

  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setError(null);
    setBusy(true);
    try {
      setSetup(await api.enableTwoFactor());
    } catch {
      setError('2FA başlatılamadı.');
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      await api.confirmTwoFactor(code.trim());
      window.location.reload();
    } catch {
      setError('Kod hatalı. Uygulamadaki güncel kodu girin.');
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setError(null);
    setBusy(true);
    try {
      await api.disableTwoFactor(code.trim());
      window.location.reload();
    } catch {
      setError('Kod hatalı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="İki adımlı doğrulama (2FA)"
        right={
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {enabled ? 'Aktif' : 'Kapalı'}
          </span>
        }
      >
        <p className="text-sm text-muted">
          {enabled
            ? 'Hesabınız TOTP ile korunuyor.'
            : 'Google Authenticator / Authy ile hesabınızı koruyun.'}
        </p>

        {!enabled && !setup && (
          <Button className="mt-3" onClick={begin} disabled={busy}>
            {busy ? '…' : 'Etkinleştir'}
          </Button>
        )}

        {!enabled && setup && (
          <div className="mt-3 space-y-2 rounded-lg border border-line bg-canvas p-3">
            <p className="text-xs text-muted">
              Authenticator uygulamanıza bu anahtarı girin, ardından oluşan 6 haneli kodu doğrulayın:
            </p>
            <code className="block break-all rounded bg-white px-2 py-1 font-mono text-sm text-ink">{setup.secret}</code>
            <div className="flex gap-2">
              <Input placeholder="6 haneli kod" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
              <Button onClick={confirm} disabled={busy || code.trim().length < 6}>
                Doğrula
              </Button>
            </div>
          </div>
        )}

        {enabled && (
          <div className="mt-3 flex gap-2">
            <Input placeholder="Devre dışı için kod" value={code} onChange={(e) => setCode(e.target.value)} className="w-48" />
            <Button variant="ghost" onClick={disable} disabled={busy || code.trim().length < 6}>
              Devre dışı bırak
            </Button>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </Panel>
    </div>
  );
}
