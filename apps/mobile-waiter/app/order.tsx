import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgUri } from 'react-native-svg';
import { useAuthStore } from '@/stores/auth';
import { waiterApi, type OrderItemInput } from '@/api/waiter';
import { money } from '@/lib/money';
import { printAdisyon } from '@/lib/print';
import { POLL_MS, API_URL } from '@/constants/config';
import { GRADIENT } from '@/theme';

type Line = {
  key: string;
  product: any;
  qty: number;
  variantId?: number;
  variantName?: string;
  modifierIds: number[];
  modifierNames: string[];
  unitPrice: number;
};

const lineKey = (pid: number, vid: number | undefined, mods: number[]) =>
  `${pid}:${vid ?? 0}:${[...mods].sort((a, b) => a - b).join(',')}`;

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Bekliyor', bg: 'bg-slate-100', fg: 'text-slate-600' },
  preparing: { label: 'Hazırlanıyor', bg: 'bg-amber-100', fg: 'text-amber-700' },
  ready: { label: 'Hazır', bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  served: { label: 'Servis edildi', bg: 'bg-slate-100', fg: 'text-slate-400' },
};

/** Product image URL, with the API host rewritten so the phone can load it
 * (the API returns 127.0.0.1 URLs). Returns {uri, svg} or null → placeholder. */
function productImage(p: any): { uri: string; svg: boolean } | null {
  const raw = p?.images?.[0] ?? p?.image_paths_json?.[0] ?? p?.image_path;
  if (!raw) return null;
  const base = API_URL.replace(/\/$/, '');
  let uri = String(raw).replace(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i, base);
  if (!/^https?:\/\//i.test(uri)) uri = `${base}/${uri.replace(/^\//, '')}`; // relative → API host
  return { uri, svg: /\.svg(\?|$)/i.test(uri) };
}

function ProductThumb({ product }: { product: any }) {
  const img = productImage(product);
  if (img?.svg) return <SvgUri uri={img.uri} width="100%" height="100%" />;
  if (img) return <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />;
  // No image → clean initials tile (emoji glyphs aren't reliable across devices).
  const initials = (product?.name ?? '?').trim().slice(0, 2).toLocaleUpperCase('tr');
  return (
    <View className="h-full w-full items-center justify-center bg-brand-50">
      <Text className="text-xl font-black text-brand-300">{initials}</Text>
    </View>
  );
}

export default function OrderScreen() {
  const router = useRouter();
  const { id, code } = useLocalSearchParams<{ id: string; code: string }>();
  const tableId = Number(id);
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token)!;
  const currency = useAuthStore((s) => s.currency)();
  const venue = useAuthStore((s) => s.tenant?.name) ?? 'ComiQR';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [order, setOrder] = useState<any | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [customizing, setCustomizing] = useState<any | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'sepet' | 'adisyon'>('sepet');
  const [service, setService] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serving, setServing] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [printing, setPrinting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    const orders = await waiterApi.openOrders(token).catch(() => [] as any[]);
    setOrder(orders.find((o: any) => o.table_code === code) ?? null);
  }, [token, code]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ps, cs] = await Promise.all([
        waiterApi.products(token).catch(() => [] as any[]),
        waiterApi.categories(token).catch(() => [] as any[]),
      ]);
      if (!alive) return;
      setProducts(ps.filter((p: any) => p.is_active));
      setCategories(cs);
      if (cs.length) setActiveCat(cs[0].id);
      await loadOrder();
      setLoading(false);
    })();
    const timer = setInterval(loadOrder, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token, loadOrder]);

  const shown = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return products.filter(
      (p) => (q ? p.name.toLocaleLowerCase('tr').includes(q) : activeCat ? p.category_id === activeCat : true),
    );
  }, [products, activeCat, search]);

  function pick(product: any) {
    const hasOptions = (product.variants?.length ?? 0) > 0 || (product.modifier_groups?.length ?? 0) > 0;
    if (hasOptions) setCustomizing(product);
    else addLine(product, undefined, [], []);
  }

  function addLine(product: any, variant: any, modifierIds: number[], modifierNames: string[]) {
    const modSum = (product.modifier_groups ?? [])
      .flatMap((g: any) => g.modifiers)
      .filter((m: any) => modifierIds.includes(m.id))
      .reduce((s: number, m: any) => s + Number(m.price_delta), 0);
    const unitPrice = Number(product.price) + Number(variant?.price_delta ?? 0) + modSum;
    const key = lineKey(product.id, variant?.id, modifierIds);
    setCart((c) => {
      const cur = c[key];
      return {
        ...c,
        [key]: cur
          ? { ...cur, qty: cur.qty + 1 }
          : { key, product, qty: 1, variantId: variant?.id, variantName: variant?.name, modifierIds, modifierNames, unitPrice },
      };
    });
  }

  function setQty(key: string, qty: number) {
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[key];
      else n[key] = { ...n[key], qty };
      return n;
    });
  }

  const cartLines = Object.values(cart);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const committed = (order?.items ?? []).filter((i: any) => i.status !== 'cancelled');
  const runningSubtotal = Number(order?.subtotal ?? 0) + cartTotal;
  const grand = Number(order?.grand_total ?? 0) + cartTotal + (service ? runningSubtotal * 0.1 : 0);

  async function send() {
    if (cartLines.length === 0) return;
    setBusy(true);
    setErr(null);
    const items: OrderItemInput[] = cartLines.map((l) => ({
      product_id: l.product.id,
      variant_id: l.variantId,
      quantity: l.qty,
      modifiers: l.modifierIds,
    }));
    try {
      const res = order ? await waiterApi.addItems(token, order.id, items) : await waiterApi.placeOrder(token, tableId, items);
      if (service && res?.id) await waiterApi.serviceCharge(token, res.id, 10).catch(() => undefined);
      setCart({});
      setService(false);
      await loadOrder();
      setCartTab('adisyon');
    } catch {
      setErr('Sipariş gönderilemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function serve(itemId: number) {
    setServing(itemId);
    try {
      await waiterApi.served(token, itemId);
      await loadOrder();
    } finally {
      setServing(null);
    }
  }

  function cancelItem(item: any) {
    Alert.alert('Kalemi iptal et?', `${item.quantity}× ${item.product_name ?? 'Ürün'} adisyondan çıkarılacak.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'İptal Et',
        style: 'destructive',
        onPress: async () => {
          if (!order) return;
          setCancelling(item.id);
          try {
            await waiterApi.voidItem(token, order.id, item.id);
            await loadOrder();
          } finally {
            setCancelling(null);
          }
        },
      },
    ]);
  }

  async function onPrint() {
    if (!order || printing) return;
    setPrinting(true);
    try {
      await printAdisyon({ order, tableCode: String(code), currency, venue });
    } catch {
      /* kullanıcı diyaloğu iptal etti veya yazıcı yok */
    } finally {
      setPrinting(false);
    }
  }

  return (
    <View className="flex-1 bg-slate-100">
      {/* Gradient header */}
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View className="flex-row items-center gap-2 px-3 py-3">
            <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full active:bg-white/20">
              <Text className="text-2xl text-white">‹</Text>
            </Pressable>
            <Text className="flex-1 text-lg font-extrabold uppercase text-white" numberOfLines={1}>{code}</Text>
            <Pressable onPress={() => { setCartTab('sepet'); setCartOpen(true); }} className="h-10 w-10 items-center justify-center rounded-full active:bg-white/20">
              <Text className="text-xl text-white">🛒</Text>
              {cartCount > 0 && (
                <View className="absolute right-1 top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-white px-1">
                  <Text className="text-[10px] font-extrabold text-brand-600">{cartCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => { setCartTab('adisyon'); setCartOpen(true); }} className="h-10 w-10 items-center justify-center rounded-full active:bg-white/20">
              <Text className="text-lg text-white">🧾</Text>
              {committed.length > 0 && (
                <View className="absolute right-1 top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-white px-1">
                  <Text className="text-[10px] font-extrabold text-brand-600">{committed.length}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Category tabs */}
      <View className="border-b border-slate-200 bg-white">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-2">
          {categories.map((c) => {
            const active = !search && c.id === activeCat;
            return (
              <Pressable key={c.id} onPress={() => { setSearch(''); setActiveCat(c.id); }} className="px-4 py-3">
                <Text className={`text-[15px] font-bold uppercase ${active ? 'text-brand-600' : 'text-slate-400'}`}>{c.name}</Text>
                {active && <View className="mt-1.5 h-1 rounded-full bg-brand-500" />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Search */}
      <View className="bg-white px-3 pb-2 pt-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Ürün ara…"
          placeholderTextColor="#94a3b8"
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900"
        />
      </View>

      {/* Product grid (3 columns, photos) */}
      <View className="flex-1">
      {loading ? (
        <ActivityIndicator className="mt-10" color="#f05020" />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="p-2 pb-4">
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {shown.map((p) => (
              <View key={p.id} style={{ width: '33.333%', padding: 4 }}>
                <Pressable onPress={() => pick(p)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white active:opacity-80">
                  <View style={{ aspectRatio: 1 }} className="w-full bg-slate-100">
                    <ProductThumb product={p} />
                  </View>
                  <View className="px-2 py-2">
                    <Text className="text-[12px] font-semibold leading-tight text-slate-800" numberOfLines={2}>{p.name}</Text>
                    <Text className="mt-1 text-[13px] font-extrabold text-brand-600">{money(p.price, currency)}</Text>
                  </View>
                </Pressable>
              </View>
            ))}
            {shown.length === 0 && <Text className="w-full py-10 text-center text-sm text-slate-400">Ürün bulunamadı</Text>}
          </View>
        </ScrollView>
      )}
      </View>

      {/* Bottom action bar — always-visible Geri + cart summary */}
      <View style={{ paddingBottom: Math.max(insets.bottom, 8) }} className="flex-row items-center gap-2 border-t border-slate-200 bg-white px-3 pt-2.5">
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-1 rounded-xl border border-slate-300 bg-white px-5 py-3 active:opacity-70">
          <Text className="text-lg text-slate-600">‹</Text>
          <Text className="text-sm font-bold text-slate-700">Geri</Text>
        </Pressable>
        {cartCount > 0 ? (
          <Pressable onPress={() => { setCartTab('sepet'); setCartOpen(true); }} className="flex-1 flex-row items-center justify-between rounded-xl bg-brand-500 px-4 py-3 active:opacity-90">
            <Text className="text-sm font-bold text-white">🛒 {cartCount} ürün</Text>
            <Text className="text-sm font-extrabold text-white">{money(cartTotal, currency)} ›</Text>
          </Pressable>
        ) : (
          <View className="flex-1" />
        )}
      </View>

      {/* Cart sheet (Sepet / Adisyonlar) */}
      <Modal visible={cartOpen} transparent animationType="slide" onRequestClose={() => setCartOpen(false)}>
        <View className="flex-1 bg-black/30">
          <Pressable className="h-16" onPress={() => setCartOpen(false)} />
          <View className="flex-1 overflow-hidden rounded-t-3xl bg-white">
            {/* Tabs */}
            <View className="flex-row gap-2 border-b border-slate-100 p-3">
              <Pressable onPress={() => setCartTab('sepet')} className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-2.5 ${cartTab === 'sepet' ? 'bg-brand-500' : 'border border-slate-200'}`}>
                <Text className={cartTab === 'sepet' ? 'text-white' : 'text-slate-500'}>🛒</Text>
                <Text className={`text-sm font-bold ${cartTab === 'sepet' ? 'text-white' : 'text-slate-500'}`}>Sepet</Text>
              </Pressable>
              <Pressable onPress={() => setCartTab('adisyon')} className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-2.5 ${cartTab === 'adisyon' ? 'bg-brand-500' : 'border border-slate-200'}`}>
                <Text className={cartTab === 'adisyon' ? 'text-white' : 'text-slate-500'}>🧾</Text>
                <Text className={`text-sm font-bold ${cartTab === 'adisyon' ? 'text-white' : 'text-slate-500'}`}>Adisyonlar</Text>
              </Pressable>
              <Pressable onPress={() => setCartOpen(false)} className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100">
                <Text className="text-lg text-slate-500">×</Text>
              </Pressable>
            </View>

            <Text className="px-4 pb-1 pt-3 text-xl font-extrabold text-slate-900">{code}</Text>

            {cartTab === 'sepet' ? (
              <>
                <ScrollView className="flex-1 px-4">
                  {cartLines.length === 0 ? (
                    <Text className="py-16 text-center text-sm text-slate-400">Sepet boş — menüden ürün ekle.</Text>
                  ) : (
                    cartLines.map((l) => (
                      <View key={l.key} className="border-b border-slate-100 py-3">
                        <View className="flex-row items-start justify-between">
                          <Text className="mr-2 flex-1 text-sm font-bold uppercase text-slate-800">{l.product.name}</Text>
                          <Text className="text-sm font-extrabold text-brand-600">{money(l.unitPrice * l.qty, currency)}</Text>
                        </View>
                        {(l.variantName || l.modifierNames.length > 0) && (
                          <Text className="mt-0.5 text-[12px] text-slate-500">{[l.variantName, ...l.modifierNames].filter(Boolean).join(', ')}</Text>
                        )}
                        <View className="mt-2 flex-row items-center gap-3">
                          <Pressable onPress={() => setQty(l.key, l.qty - 1)} className="h-8 w-8 items-center justify-center rounded-full bg-brand-500 active:opacity-80">
                            <Text className="text-lg font-bold text-white">−</Text>
                          </Pressable>
                          <Text className="text-base font-extrabold text-slate-900">{l.qty}</Text>
                          <Pressable onPress={() => setQty(l.key, l.qty + 1)} className="h-8 w-8 items-center justify-center rounded-full bg-brand-500 active:opacity-80">
                            <Text className="text-lg font-bold text-white">＋</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View className="border-t border-slate-100 px-4 pb-6 pt-3">
                  <Pressable onPress={() => setService((s) => !s)} className={`mb-3 flex-row items-center justify-between rounded-xl px-3.5 py-3 ${service ? 'bg-amber-400' : 'bg-amber-100'}`}>
                    <View className="flex-row items-center gap-2">
                      <View className={`h-5 w-5 items-center justify-center rounded ${service ? 'bg-white' : 'border border-amber-400'}`}>
                        {service && <Text className="text-xs font-bold text-amber-500">✓</Text>}
                      </View>
                      <Text className={`text-sm font-bold ${service ? 'text-white' : 'text-amber-700'}`}>Servis Ücreti (%10)</Text>
                    </View>
                    <Text className={`text-sm font-bold ${service ? 'text-white' : 'text-amber-700'}`}>{money(runningSubtotal * 0.1, currency)}</Text>
                  </Pressable>

                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-slate-500">TOPLAM</Text>
                    <Text className="text-2xl font-black text-slate-900">{money(grand, currency)}</Text>
                  </View>
                  {err && <Text className="mb-2 text-xs text-red-600">{err}</Text>}
                  <Pressable onPress={send} disabled={busy || cartLines.length === 0} className="items-center rounded-2xl bg-emerald-600 py-4 active:opacity-90" style={{ opacity: busy || cartLines.length === 0 ? 0.5 : 1 }}>
                    {busy ? <ActivityIndicator color="#ffffff" /> : <Text className="text-base font-bold text-white">Siparişi Gönder</Text>}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <ScrollView className="flex-1 px-4">
                  {committed.length === 0 ? (
                    <Text className="py-16 text-center text-sm text-slate-400">Bu masada henüz sipariş yok.</Text>
                  ) : (
                    committed.map((i: any) => {
                      const st = STATUS[i.status] ?? STATUS.pending;
                      return (
                        <View key={i.id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-slate-800">{i.quantity}× {i.product_name ?? 'Ürün'}</Text>
                            {(i.modifiers ?? []).length > 0 && <Text className="text-[11px] text-slate-500">{i.modifiers.map((m: any) => m.name).join(', ')}</Text>}
                          </View>
                          <View className="flex-row items-center gap-2">
                            {i.status === 'ready' ? (
                              <Pressable onPress={() => serve(i.id)} disabled={serving === i.id} className="rounded-lg bg-emerald-600 px-3 py-1.5 active:opacity-80" style={{ opacity: serving === i.id ? 0.5 : 1 }}>
                                <Text className="text-xs font-bold text-white">Servis Et</Text>
                              </Pressable>
                            ) : (
                              <View className={`rounded-full px-2.5 py-1 ${st.bg}`}>
                                <Text className={`text-[11px] font-bold ${st.fg}`}>{st.label}</Text>
                              </View>
                            )}
                            {i.status !== 'served' && (
                              <Pressable onPress={() => cancelItem(i)} disabled={cancelling === i.id} className="rounded-lg bg-red-50 px-2.5 py-1.5 active:opacity-70" style={{ opacity: cancelling === i.id ? 0.5 : 1 }}>
                                <Text className="text-xs font-bold text-red-500">İptal</Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
                {committed.length > 0 && (
                  <View className="border-t border-slate-100 px-4 pb-6 pt-3">
                    <View className="mb-3 flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-slate-500">TOPLAM</Text>
                      <Text className="text-xl font-black text-slate-900">{money(order?.grand_total ?? 0, currency)}</Text>
                    </View>
                    <Pressable onPress={onPrint} disabled={printing} className="items-center rounded-2xl bg-slate-900 py-4 active:opacity-90" style={{ opacity: printing ? 0.6 : 1 }}>
                      {printing ? <ActivityIndicator color="#ffffff" /> : <Text className="text-base font-bold text-white">Adisyon Yazdır</Text>}
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {customizing && (
        <OptionsModal
          product={customizing}
          currency={currency}
          onClose={() => setCustomizing(null)}
          onAdd={(variant, ids, names) => {
            addLine(customizing, variant, ids, names);
            setCustomizing(null);
          }}
        />
      )}
    </View>
  );
}

/** Variant + modifier picker (min/max + required gating). */
function OptionsModal({
  product,
  currency,
  onClose,
  onAdd,
}: {
  product: any;
  currency: string;
  onClose: () => void;
  onAdd: (variant: any, ids: number[], names: string[]) => void;
}) {
  const variants = product.variants ?? [];
  const groups = product.modifier_groups ?? [];
  const [variantId, setVariantId] = useState<number | undefined>(variants.find((v: any) => v.is_default)?.id ?? variants[0]?.id);
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  const variant = variants.find((v: any) => v.id === variantId);
  const chosen = groups
    .flatMap((g: any) => (selected[g.id] ?? []).map((mid: number) => (g.modifiers ?? []).find((m: any) => m.id === mid)))
    .filter(Boolean);
  const missingRequired = groups.some((g: any) => {
    const min = g.is_required ? Math.max(1, g.min_select) : g.min_select;
    return (selected[g.id] ?? []).length < min;
  });
  const price = Number(product.price) + Number(variant?.price_delta ?? 0) + chosen.reduce((s: number, m: any) => s + Number(m.price_delta), 0);

  function toggle(g: any, mid: number) {
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      let next: number[];
      if (g.max_select <= 1) next = cur.includes(mid) ? (g.is_required ? cur : []) : [mid];
      else if (cur.includes(mid)) next = cur.filter((x) => x !== mid);
      else if (cur.length < g.max_select) next = [...cur, mid];
      else next = cur;
      return { ...prev, [g.id]: next };
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[80%] rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-3">
            <Text className="flex-1 text-base font-bold text-slate-900" numberOfLines={1}>{product.name}</Text>
            <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full active:bg-slate-100">
              <Text className="text-lg text-slate-500">×</Text>
            </Pressable>
          </View>
          <ScrollView className="px-4 py-3">
            {variants.length > 0 && (
              <View className="mb-4">
                <Text className="mb-2 text-xs font-bold uppercase text-slate-500">Seçenek</Text>
                {variants.map((v: any) => (
                  <Pressable key={v.id} onPress={() => setVariantId(v.id)} className={`mb-1.5 flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${variantId === v.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <Text className="text-sm text-slate-900">{v.name}</Text>
                    <Text className="text-xs text-slate-500">{Number(v.price_delta) ? money(v.price_delta, currency) : ''}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {groups.map((g: any) => (
              <View key={g.id} className="mb-4">
                <Text className="mb-2 text-xs font-bold uppercase text-slate-500">{g.name}{g.is_required ? ' *' : ''}{g.max_select > 1 ? ` (en fazla ${g.max_select})` : ''}</Text>
                {(g.modifiers ?? []).map((m: any) => {
                  const on = (selected[g.id] ?? []).includes(m.id);
                  return (
                    <Pressable key={m.id} onPress={() => toggle(g, m.id)} className={`mb-1.5 flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${on ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                      <Text className="text-sm text-slate-900">{on ? '✓ ' : ''}{m.name}</Text>
                      <Text className="text-xs text-slate-500">{Number(m.price_delta) ? `+${money(m.price_delta, currency)}` : ''}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View className="border-t border-slate-100 px-4 pb-6 pt-3">
            <Pressable onPress={() => { if (!missingRequired) onAdd(variant, chosen.map((m: any) => m.id), [variant?.name, ...chosen.map((m: any) => m.name)].filter(Boolean) as string[]); }} disabled={missingRequired} className="items-center rounded-xl bg-brand-500 py-3.5 active:opacity-90" style={{ opacity: missingRequired ? 0.5 : 1 }}>
              <Text className="text-sm font-bold text-white">Ekle · {money(price, currency)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
