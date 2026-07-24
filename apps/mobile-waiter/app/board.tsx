import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth';
import { waiterApi, type ReadyItem, type ServiceCall, type Table } from '@/api/waiter';
import { POLL_MS } from '@/constants/config';

export default function BoardScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [tables, setTables] = useState<Table[]>([]);
  const [calls, setCalls] = useState<ServiceCall[]>([]);
  const [ready, setReady] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tb, notif] = await Promise.all([waiterApi.tables(token), waiterApi.notifications(token)]);
      setTables(tb);
      setCalls(notif.service_calls ?? []);
      setReady(notif.ready_items ?? []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.status === 402 ? 'Planın garson uygulamasını içermiyor.' : e?.status === 403 ? 'Bu hesabın erişimi yok.' : 'Yüklenemedi, tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Refresh whenever the board gains focus (e.g. returning from an order).
  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, POLL_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  async function ack(sessionId: number) {
    setBusy(sessionId);
    try {
      await waiterApi.ack(token, sessionId);
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function serve(itemId: number) {
    setBusy(itemId);
    try {
      await waiterApi.served(token, itemId);
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  const occupied = useMemo(() => tables.filter((x) => x.state === 'occupied').length, [tables]);
  const notifCount = calls.length + ready.length;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <View className="flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
            <Text className="text-base">🍽️</Text>
          </View>
          <View>
            <Text className="text-sm font-bold text-slate-900">Garson Paneli</Text>
            <Text className="text-[11px] text-slate-500">{user?.name}</Text>
          </View>
        </View>
        <Pressable onPress={onLogout} className="rounded-full border border-slate-200 px-3 py-1.5 active:opacity-70">
          <Text className="text-xs font-semibold text-slate-500">Çıkış</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-4 pb-10 pt-4">
        {err ? (
          <View className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6">
            <Text className="text-center text-sm text-amber-800">{err}</Text>
            <Pressable onPress={load} className="mt-3 items-center rounded-lg bg-amber-600 py-2.5 active:opacity-80">
              <Text className="text-sm font-bold text-white">Tekrar dene</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Notifications */}
            <View className="mb-6">
              <View className="mb-2 flex-row items-center gap-2">
                <Text className="text-[13px] font-bold uppercase tracking-wide text-slate-500">Bildirimler</Text>
                {notifCount > 0 && (
                  <View className="h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5">
                    <Text className="text-[11px] font-bold text-white">{notifCount}</Text>
                  </View>
                )}
              </View>

              {loading && tables.length === 0 ? (
                <ActivityIndicator className="py-6" color="#2f83f5" />
              ) : notifCount === 0 ? (
                <View className="rounded-2xl border border-dashed border-slate-200 bg-white py-6">
                  <Text className="text-center text-sm text-slate-400">Her şey yolunda 🎉</Text>
                </View>
              ) : (
                <View className="gap-2">
                  {calls.map((c) => (
                    <View key={`c${c.session_id}`} className="flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                      <View className="h-9 w-9 items-center justify-center rounded-lg bg-amber-500">
                        <Text className="text-base">{c.bill_requested && !c.waiter_called ? '🧾' : '🔔'}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-amber-900">{c.table_code}</Text>
                        <Text className="text-[11px] text-amber-700">
                          {c.waiter_called && c.bill_requested ? 'Garson + hesap' : c.bill_requested ? 'Hesap istendi' : 'Garson çağrıldı'}
                        </Text>
                      </View>
                      <Pressable onPress={() => ack(c.session_id)} disabled={busy === c.session_id} className="rounded-lg bg-amber-600 px-3 py-2 active:opacity-80" style={{ opacity: busy === c.session_id ? 0.5 : 1 }}>
                        <Text className="text-xs font-bold text-white">Onayla</Text>
                      </Pressable>
                    </View>
                  ))}
                  {ready.map((it) => (
                    <View key={`r${it.order_item_id}`} className="flex-row items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                      <View className="h-9 w-9 items-center justify-center rounded-lg bg-emerald-500">
                        <Text className="text-base">🍽️</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-emerald-900">{it.quantity}× {it.product ?? 'Ürün'}</Text>
                        <Text className="text-[11px] text-emerald-700">Servise hazır</Text>
                      </View>
                      <Pressable onPress={() => serve(it.order_item_id)} disabled={busy === it.order_item_id} className="rounded-lg bg-emerald-600 px-3 py-2 active:opacity-80" style={{ opacity: busy === it.order_item_id ? 0.5 : 1 }}>
                        <Text className="text-xs font-bold text-white">Servis Et</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Floor plan */}
            <View className="mb-1 flex-row items-end justify-between">
              <Text className="text-[13px] font-bold uppercase tracking-wide text-slate-500">Kat Planı</Text>
              <Text className="text-[11px] text-slate-500">{occupied}/{tables.length} dolu</Text>
            </View>
            <Text className="mb-3 text-[11px] text-slate-400">Sipariş almak için masaya dokun</Text>

            {tables.length === 0 && !loading ? (
              <View className="rounded-2xl border border-dashed border-slate-200 bg-white py-6">
                <Text className="text-center text-sm text-slate-400">Masa bulunamadı</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                {tables.map((tb) => {
                  const flagged = tb.waiter_called || tb.bill_requested;
                  const border = flagged ? 'border-amber-300 bg-amber-50' : tb.state === 'occupied' ? 'border-slate-300 bg-white' : 'border-emerald-200 bg-emerald-50';
                  const textColor = flagged ? 'text-amber-800' : tb.state === 'occupied' ? 'text-slate-900' : 'text-emerald-700';
                  return (
                    <View key={tb.table_id} style={{ width: '33.333%', padding: 4 }}>
                      <Pressable
                        onPress={() => router.push(`/order?id=${tb.table_id}&code=${encodeURIComponent(tb.code)}`)}
                        className={`aspect-square items-center justify-center rounded-2xl border-2 ${border} active:opacity-80`}
                      >
                        {flagged && <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />}
                        <Text className="text-xl">{tb.state === 'occupied' ? '🍽️' : '🪑'}</Text>
                        <Text className={`mt-0.5 text-sm font-bold ${textColor}`}>{tb.code}</Text>
                        <Text className={`text-[10px] font-semibold ${textColor}`}>{tb.state === 'occupied' ? 'Dolu' : 'Boş'}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
