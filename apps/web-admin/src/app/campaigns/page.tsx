'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminShell } from '@/components/AdminShell';
import { Button, Card, Input } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const CHANNELS = [
  { value: 'sms', labelKey: 'channelSms' },
  { value: 'whatsapp', labelKey: 'channelWhatsapp' },
  { value: 'email', labelKey: 'channelEmail' },
  { value: 'push', labelKey: 'channelPush' },
];

export default function CampaignsPage() {
  const t = useTranslations('campaigns');
  const c = useTranslations('common');
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
      setError(t('createError'));
    }
  }

  async function send(camp: any) {
    if (!confirm(t('confirmSend', { name: camp.name }))) return;
    setBusy(camp.id);
    try {
      await api.sendCampaign(camp.id);
      load();
    } catch {
      setError(t('sendError'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell title={t('title')}>
      <Card>
        <form className="space-y-3" onSubmit={add}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <span className="mb-1 block text-xs text-muted">{t('campaignName')}</span>
              <Input placeholder={t('campaignNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted">{t('channel')}</span>
              <select
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                {CHANNELS.map((ch) => (
                  <option key={ch.value} value={ch.value}>
                    {t(ch.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1 block text-xs text-muted">{t('audience')}</span>
              <select
                className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="all">{t('audienceAll')}</option>
                <option value="min_points">{t('audienceMinPoints')}</option>
              </select>
            </div>
            {audience === 'min_points' && (
              <div>
                <span className="mb-1 block text-xs text-muted">{t('minPoints')}</span>
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
              <span className="mb-1 block text-xs text-muted">{t('emailSubject')}</span>
              <Input placeholder={t('emailSubjectPlaceholder')} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}

          <div>
            <span className="mb-1 block text-xs text-muted">{t('message')}</span>
            <textarea
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              rows={3}
              placeholder={t('messagePlaceholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>

          <Button type="submit">{t('createDraft')}</Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {campaigns.length === 0 && <p className="text-sm text-muted">{t('empty')}</p>}
        {campaigns.map((camp) => (
          <Card key={camp.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{camp.name}</span>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs uppercase text-muted">{camp.channel}</span>
                  {camp.status === 'sent' ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      {t('sentCount', { count: camp.sent_count })}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      {t('draft')}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  {camp.audience === 'min_points' ? t('audienceMinPointsValue', { points: camp.min_points }) : t('audienceAll')} · {camp.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {camp.status !== 'sent' && (
                  <Button type="button" onClick={() => send(camp)} disabled={busy === camp.id}>
                    {busy === camp.id ? t('sending') : t('send')}
                  </Button>
                )}
                <button
                  onClick={async () => {
                    await api.deleteCampaign(camp.id);
                    load();
                  }}
                  className="text-xs text-red-600"
                >
                  {c('delete')}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
