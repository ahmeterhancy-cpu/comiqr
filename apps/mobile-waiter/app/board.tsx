import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, Vibration, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useAuthStore } from '@/stores/auth';
import { waiterApi, type ReadyItem, type ServiceCall, type Table } from '@/api/waiter';
import { POLL_MS } from '@/constants/config';
import { GRADIENT } from '@/theme';
import { money } from '@/lib/money';
import { hhmm } from '@/lib/time';

export default function BoardScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user);
  const currency = useAuthStore((s) => s.currency)();
  const logout = useAuthStore((s) => s.logout);

  const [tables, setTables] = useState<Table[]>([]);
  const [calls, setCalls] = useState<ServiceCall[]>([]);
  const [ready, setReady] = useState<ReadyItem[]>([]);
  const [area, setArea] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Sesli + titreşimli uyarı — güçlü ve cevaplanana kadar döngüde.
  const alertPlayer = useAudioPlayer(require('../assets/alert.wav'));

  // Sessiz/DND modunda bile duyulsun + tam ses + döngü.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    try {
      alertPlayer.loop = true;
      alertPlayer.volume = 1;
    } catch {
      /* ignore */
    }
  }, [alertPlayer]);

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

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, POLL_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  // Distinct dining areas → top tabs (fallback to a single "Masalar" bucket).
  const areas = useMemo(() => {
    const set: string[] = [];
    for (const t of tables) {
      const a = t.area ?? 'Masalar';
      if (!set.includes(a)) set.push(a);
    }
    return set;
  }, [tables]);

  useEffect(() => {
    if (areas.length && (area === null || !areas.includes(area))) setArea(areas[0]);
  }, [areas, area]);

  const shown = useMemo(() => tables.filter((t) => (t.area ?? 'Masalar') === area), [tables, area]);

  // Cevaplanmamış çağrı OLDUĞU sürece alarm döngüde çalar + telefon sürekli
  // titrer. Herhangi bir garson Onayla'ya basıp çağrıyı temizleyince (poll ile
  // calls boşalır) alarm susar. Uygulama açılışında bekleyen çağrı varsa da çalar.
  const hasCalls = calls.length > 0;
  useEffect(() => {
    if (!hasCalls) return;
    try {
      alertPlayer.seekTo(0);
      alertPlayer.play();
    } catch {
      /* ignore */
    }
    Vibration.vibrate([0, 700, 400, 700, 400, 700], true);
    return () => {
      try {
        alertPlayer.pause();
      } catch {
        /* ignore */
      }
      Vibration.cancel();
    };
  }, [hasCalls, alertPlayer]);

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
    setMenuOpen(false);
    await logout();
    router.replace('/login');
  }

  const notifCount = calls.length + ready.length;

  return (
    <View className="flex-1 bg-slate-100">
      {/* Gradient header */}
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-row items-center gap-2.5">
              <View className="rounded-lg bg-white px-2 py-1">
                <Image source={require('../assets/comiqr-logo.png')} style={{ width: 72, height: 22 }} resizeMode="contain" />
              </View>
              <Text className="text-xl font-extrabold text-white">Garson</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Pressable onPress={() => setNotifOpen(true)} className="h-10 w-10 items-center justify-center rounded-full active:bg-white/20">
                <Text className="text-xl text-white">🔔</Text>
                {notifCount > 0 && (
                  <View className="absolute right-1.5 top-1 h-4 min-w-4 items-center justify-center rounded-full bg-white px-1">
                    <Text className="text-[10px] font-extrabold text-brand-600">{notifCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={() => setMenuOpen(true)} className="h-10 w-10 items-center justify-center rounded-full active:bg-white/20">
                <Text className="text-2xl text-white">☰</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Area tabs */}
      {areas.length > 0 && (
        <View className="border-b border-slate-200 bg-white">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-2">
            {areas.map((a) => {
              const active = a === area;
              return (
                <Pressable key={a} onPress={() => setArea(a)} className="px-4 py-3.5">
                  <Text className={`text-base font-bold uppercase tracking-wide ${active ? 'text-brand-600' : 'text-slate-400'}`}>{a}</Text>
                  {active && <View className="mt-1.5 h-1 rounded-full bg-brand-500" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {err ? (
        <View className="m-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6">
          <Text className="text-center text-sm text-amber-800">{err}</Text>
          <Pressable onPress={load} className="mt-3 items-center rounded-lg bg-amber-600 py-2.5 active:opacity-80">
            <Text className="text-sm font-bold text-white">Tekrar dene</Text>
          </Pressable>
        </View>
      ) : loading && tables.length === 0 ? (
        <ActivityIndicator className="mt-10" color="#f4337a" />
      ) : (
        <ScrollView contentContainerClassName="p-3">
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
            {shown.map((t) => (
              <View key={t.table_id} style={{ width: '33.333%', padding: 5 }}>
                <TableCard table={t} currency={currency} onPress={() => router.push(`/order?id=${t.table_id}&code=${encodeURIComponent(t.code)}`)} />
              </View>
            ))}
            {shown.length === 0 && <Text className="w-full py-10 text-center text-sm text-slate-400">Bu alanda masa yok</Text>}
          </View>
        </ScrollView>
      )}

      {/* Notifications sheet */}
      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setNotifOpen(false)} />
        <View className="absolute inset-x-0 bottom-0 max-h-[70%] rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-3">
            <Text className="text-base font-bold text-slate-900">Bildirimler</Text>
            <Pressable onPress={() => setNotifOpen(false)} className="h-8 w-8 items-center justify-center rounded-full active:bg-slate-100">
              <Text className="text-lg text-slate-500">×</Text>
            </Pressable>
          </View>
          <ScrollView className="px-4 py-3">
            {notifCount === 0 ? (
              <Text className="py-6 text-center text-sm text-slate-400">Her şey yolunda 🎉</Text>
            ) : (
              <View className="gap-2 pb-4">
                {calls.map((c) => (
                  <View key={`c${c.session_id}`} className="flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                    <Text className="text-xl">{c.bill_requested && !c.waiter_called ? '🧾' : '🔔'}</Text>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-amber-900">{c.table_code}</Text>
                      <Text className="text-[11px] text-amber-700">{c.waiter_called && c.bill_requested ? 'Garson + hesap' : c.bill_requested ? 'Hesap istendi' : 'Garson çağrıldı'}</Text>
                    </View>
                    <Pressable onPress={() => ack(c.session_id)} disabled={busy === c.session_id} className="rounded-lg bg-amber-600 px-3 py-2 active:opacity-80" style={{ opacity: busy === c.session_id ? 0.5 : 1 }}>
                      <Text className="text-xs font-bold text-white">Onayla</Text>
                    </Pressable>
                  </View>
                ))}
                {ready.map((it) => (
                  <View key={`r${it.order_item_id}`} className="flex-row items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                    <Text className="text-xl">🍴</Text>
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
          </ScrollView>
        </View>
      </Modal>

      {/* Hamburger menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setMenuOpen(false)}>
          <View className="absolute right-3 top-14 w-56 rounded-2xl bg-white p-2 shadow-xl">
            <View className="border-b border-slate-100 px-3 py-2.5">
              <Text className="text-sm font-bold text-slate-900">{user?.name}</Text>
              <Text className="text-[11px] text-slate-500">{user?.email}</Text>
            </View>
            <Pressable onPress={onLogout} className="mt-1 flex-row items-center gap-2 rounded-xl px-3 py-3 active:bg-slate-100">
              <Text className="text-base">⎋</Text>
              <Text className="text-sm font-semibold text-red-600">Çıkış</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function TableCard({ table, currency, onPress }: { table: Table; currency: string; onPress: () => void }) {
  const flagged = table.waiter_called || table.bill_requested;
  if (table.state === 'occupied') {
    return (
      <Pressable onPress={onPress} className="overflow-hidden rounded-2xl active:opacity-90">
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 132 }}>
          <View className="flex-1 px-3 pb-2.5 pt-2.5">
            <View className="mb-2 h-1.5 w-8 self-center rounded-full bg-white/40" />
            {flagged && <View className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-white" />}
            <View className="flex-1 items-center justify-center">
              <Text className="text-base font-extrabold text-white" numberOfLines={1}>{table.code}</Text>
              {table.total != null && <Text className="mt-0.5 text-lg font-black text-white">{money(table.total, currency)}</Text>}
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-semibold text-white/85" numberOfLines={1}>{flagged ? (table.bill_requested ? 'Hesap' : 'Çağrı') : 'Açık'}</Text>
              <Text className="text-[10px] font-semibold text-white/85">{hhmm(table.opened_at)}</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} className="rounded-2xl border border-slate-200 bg-white px-3 pb-3 pt-2.5 active:opacity-80" style={{ minHeight: 132 }}>
      <View className="mb-2 h-1.5 w-8 self-center rounded-full bg-slate-200" />
      <View className="flex-1 items-center justify-center">
        <Text className="text-base font-bold text-slate-800" numberOfLines={1}>{table.code}</Text>
        <Text className="mt-0.5 text-xs font-semibold text-slate-400">Boş</Text>
      </View>
    </Pressable>
  );
}
