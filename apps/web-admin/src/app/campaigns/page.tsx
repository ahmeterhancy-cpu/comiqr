'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const CHANNELS = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-posta' },
  { value: 'push', label: 'Push' },
];

export default function CampaignsPage() {
  const { api, ready } = useApi();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('sms');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [minPoints, setMinPoints] = useState('100');
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setCampaigns(await api.adminCampaigns()), [api]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createCampaign({
        name: name.trim(),
        channel,
        subject: channel === 'email' ? subject.trim() || null : null,
        body: body.trim(),
        audience,
        min_points: audience === 'min_points' ? Number(minPoints || 0) : null,
      });
      setName('');
      setSubject('');
      setBody('');
      load();
    } catch {
      setError('Kampanya oluşturulamadı. Alanları kontrol edin.');
    }
  }

  async function send(c: any) {
    if (!confirm(`"${c.name}" kampanyası hedef kitleye gönderilsin mi?`)) return;
    setBusy(c.id);
    try {
      await api.sendCampaign(c.id);
      load();
    } catch {
      setError('Kampanya gönderilemedi.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell title="Kampanyalar">
      <Card>
        <form className="space-y-3" onSubmit={add}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <span className="mb-1 block text-xs text-muted">Kampanya adı</span>
              <Input placeholder="Bayram indirimi" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted">Kanal</span>
              <select
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted">Hedef kitle</span>
              <select
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="all">Tüm müşteriler</option>
                <option value="min_points">Puanı ≥ olanlar</option>
              </select>
            </div>
            {audience === 'min_points' && (
              <div>
                <span className="mb-1 block text-xs text-muted">Min. puan</span>
                <Input
                  type="number"
                  className="w-24"
                  value={minPoints}
                  onChange={(e) => setMinPoints(e.target.value)}
                />
              </div>
            )}
          </div>

          {channel === 'email' && (
            <div>
              <span className="mb-1 block text-xs text-muted">E-posta konusu</span>
              <Input placeholder="Size özel fırsat" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}

          <div>
            <span className="mb-1 block text-xs text-muted">Mesaj</span>
            <textarea
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              rows={3}
              placeholder="Merhaba! Bu hafta sonu tüm menüde %15 indirim sizi bekliyor."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>

          <Button type="submit">Taslak oluştur</Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {campaigns.length === 0 && <p className="text-sm text-muted">Henüz kampanya yok.</p>}
        {campaigns.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs uppercase text-muted">{c.channel}</span>
                  {c.status === 'sent' ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      Gönderildi · {c.sent_count} kişi
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      Taslak
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  {c.audience === 'min_points' ? `Puanı ≥ ${c.min_points}` : 'Tüm müşteriler'} · {c.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {c.status !== 'sent' && (
                  <Button type="button" onClick={() => send(c)} disabled={busy === c.id}>
                    {busy === c.id ? 'Gönderiliyor…' : 'Gönder'}
                  </Button>
                )}
                <button
                  onClick={async () => {
                    await api.deleteCampaign(c.id);
                    load();
                  }}
                  className="text-xs text-red-600"
                >
                  Sil
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
