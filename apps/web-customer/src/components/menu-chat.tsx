'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ApiClient, ApiError } from '@comiqr/shared-types/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/v1';

type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * Guest AI menu assistant (Nameless-style). Floating FAB + bottom-sheet chat.
 * Self-contained: only needs the venue slug. Answers come strictly from the menu
 * via POST /menu/chat. Render only when menu.venue.ai_chat is true.
 */
export function MenuChat({ slug }: { slug?: string }) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const api = useMemo(() => new ApiClient({ baseUrl: API_URL }), []);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        { role: 'assistant', content: t('greeting') },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    const history = messages.filter((m) => m.content).slice(-6);
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setSending(true);
    try {
      const res = await api.menuChat(slug, q, history, locale);
      setMessages((m) => [...m, { role: 'assistant', content: res.answer || '…' }]);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 402
          ? t('errNotEnabled')
          : e instanceof ApiError && e.status === 503
            ? t('errUnavailable')
            : t('errGeneric');
      setMessages((m) => [...m, { role: 'assistant', content: msg }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t('fabLabel')}
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-2xl shadow-lg transition hover:bg-brand-600 active:scale-95"
          style={{ color: '#ffffff' }}
        >
          💬
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="flex h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between bg-brand-500 px-4 py-3" style={{ color: '#ffffff' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <div>
                  <p className="text-sm font-bold leading-tight" style={{ color: '#ffffff' }}>{t('title')}</p>
                  <p className="text-[11px] opacity-80" style={{ color: '#ffffff' }}>{t('subtitle')}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label={t('close')} className="rounded-full px-2 py-1 text-lg leading-none hover:bg-white/20" style={{ color: '#ffffff' }}>
                ✕
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.role === 'user' ? 'rounded-br-sm bg-brand-500' : 'rounded-bl-sm border border-line bg-white text-ink'
                    }`}
                    style={m.role === 'user' ? { color: '#ffffff' } : undefined}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-line bg-white px-3.5 py-2 text-sm text-muted">{t('typing')}</div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-line bg-surface px-3 py-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={t('placeholder')}
                maxLength={500}
                className="flex-1 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold transition hover:bg-brand-600 disabled:opacity-50"
                style={{ color: '#ffffff' }}
              >
                {t('send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
