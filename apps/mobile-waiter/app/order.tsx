import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth';
import { waiterApi, type OrderItemInput } from '@/api/waiter';
import { money } from '@/lib/money';
import { POLL_MS } from '@/constants/config';

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

export default function OrderScreen() {
  const router = useRouter();
  const { id, code } = useLocalSearchParams<{ id: string; code: string }>();
  const tableId = Number(id);
  const token = useAuthStore((s) => s.token)!;
  const currency = useAuthStore((s) => s.currency)();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [order, setOrder] = useState<any | null>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [customizing, setCustomizing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serving, setServing] = useState<number | null>(null);
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
      await loadOrder();
      setLoading(false);
    })();
    const timer = setInterval(loadOrder, POLL_MS); // live kitchen status
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token, loadOrder]);

  const shown = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return products.filter(
      (p) => (activeCat ? p.category_id === activeCat : true) && (q ? p.name.toLocaleLowerCase('tr').includes(q) : true),
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
      if (order) await waiterApi.addItems(token, order.id, items);
      else await waiterApi.placeOrder(token, tableId, items);
      setCart({});
      await loadOrder();
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

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center rounded-full active:bg-slate-100">
          <Text className="text-lg text-slate-600">‹</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-sm font-bold text-slate-900">{code}</Text>
          <Text className="text-[11px] text-slate-500">Sipariş Al</Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-3 pb-3 pt-3" keyboardShouldPersistTaps="handled">
        {/* Current table order + live kitchen status */}
        <View className="mb-4">
          <Text className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-500">Masadaki Sipariş</Text>
          {loading ? (
            <ActivityIndicator className="py-4" color="#2f83f5" />
          ) : committed.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-slate-200 bg-white py-5">
              <Text className="text-center text-sm text-slate-400">Bu masada henüz sipariş yok.</Text>
            </View>
          ) : (
            <View className="gap-2">
              {committed.map((i: any) => {
                const st = STATUS[i.status] ?? STATUS.pending;
                return (
                  <View key={i.id} className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-slate-900">{i.quantity}× {i.product_name ?? 'Ürün'}</Text>
                      {(i.modifiers ?? []).length > 0 && (
                        <Text className="text-[11px] text-slate-500">{i.modifiers.map((m: any) => m.name).join(' · ')}</Text>
                      )}
                    </View>
                    {i.status === 'ready' ? (
                      <Pressable onPress={() => serve(i.id)} disabled={serving === i.id} className="rounded-lg bg-emerald-600 px-3 py-1.5 active:opacity-80" style={{ opacity: serving === i.id ? 0.5 : 1 }}>
                        <Text className="text-xs font-bold text-white">Servis Et</Text>
                      </Pressable>
                    ) : (
                      <View className={`rounded-full px-2.5 py-1 ${st.bg}`}>
                        <Text className={`text-[11px] font-bold ${st.fg}`}>{st.label}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Product picker */}
        <Text className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-500">Ürün Ekle</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Ürün ara…"
          placeholderTextColor="#94a3b8"
          className="mb-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerClassName="gap-2 pr-3">
          <Chip active={activeCat === null} label="Tümü" onPress={() => setActiveCat(null)} />
          {categories.map((c) => (
            <Chip key={c.id} active={activeCat === c.id} label={c.name} onPress={() => setActiveCat(c.id)} />
          ))}
        </ScrollView>

        {shown.length === 0 ? (
          <Text className="py-8 text-center text-sm text-slate-400">Ürün bulunamadı</Text>
        ) : (
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {shown.map((p) => (
              <View key={p.id} style={{ width: '50%', padding: 4 }}>
                <Pressable onPress={() => pick(p)} className="rounded-2xl border border-slate-200 bg-white p-3 active:opacity-80">
                  <Text className="text-sm font-semibold text-slate-900" numberOfLines={2}>{p.name}</Text>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-brand-600">{money(p.price, currency)}</Text>
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-500">
                      <Text className="text-base font-bold text-white">＋</Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Cart / send bar */}
      {cartLines.length > 0 && (
        <View className="border-t border-slate-200 bg-white px-3 pb-4 pt-2">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Eklenecekler</Text>
            <Text className="text-xs text-slate-500">{cartCount} ürün</Text>
          </View>
          <ScrollView style={{ maxHeight: 190 }} className="mb-1">
            {cartLines.map((l) => (
              <View key={l.key} className="mb-1.5 flex-row items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-2.5 py-2">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{l.product.name}</Text>
                  {(l.variantName || l.modifierNames.length > 0) && (
                    <Text className="text-[11px] text-slate-500">{[l.variantName, ...l.modifierNames].filter(Boolean).join(' · ')}</Text>
                  )}
                  <Text className="text-[11px] text-brand-600">{money(l.unitPrice * l.qty, currency)}</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Pressable onPress={() => setQty(l.key, l.qty - 1)} className="h-7 w-7 items-center justify-center rounded-md border border-slate-200 active:opacity-70">
                    <Text className="text-base text-slate-700">−</Text>
                  </Pressable>
                  <Text className="w-5 text-center text-sm font-bold text-slate-900">{l.qty}</Text>
                  <Pressable onPress={() => setQty(l.key, l.qty + 1)} className="h-7 w-7 items-center justify-center rounded-md border border-slate-200 active:opacity-70">
                    <Text className="text-base text-slate-700">＋</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
          {err && <Text className="mb-1 text-xs text-red-600">{err}</Text>}
          <Pressable onPress={send} disabled={busy} className="mt-1.5 flex-row items-center justify-center rounded-xl bg-brand-500 py-3.5 active:opacity-90" style={{ opacity: busy ? 0.6 : 1 }}>
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-sm font-bold text-white">🍳 Mutfağa Gönder · {money(cartTotal, currency)}</Text>
            )}
          </Pressable>
        </View>
      )}

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
    </SafeAreaView>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`rounded-full px-3.5 py-1.5 ${active ? 'bg-brand-500' : 'border border-slate-200 bg-white'}`}>
      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</Text>
    </Pressable>
  );
}

/** Variant + modifier picker (mirrors the web POS Customizer: single-select variant,
 * per-group min/max modifiers, required-group gating). */
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
  const [variantId, setVariantId] = useState<number | undefined>(
    variants.find((v: any) => v.is_default)?.id ?? variants[0]?.id,
  );
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  const variant = variants.find((v: any) => v.id === variantId);
  const chosen = groups
    .flatMap((g: any) => (selected[g.id] ?? []).map((mid: number) => (g.modifiers ?? []).find((m: any) => m.id === mid)))
    .filter(Boolean);
  const missingRequired = groups.some((g: any) => {
    const min = g.is_required ? Math.max(1, g.min_select) : g.min_select;
    return (selected[g.id] ?? []).length < min;
  });
  const modSum = chosen.reduce((s: number, m: any) => s + Number(m.price_delta), 0);
  const price = Number(product.price) + Number(variant?.price_delta ?? 0) + modSum;

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

  function confirm() {
    if (missingRequired) return;
    const ids = chosen.map((m: any) => m.id);
    const names = [variant?.name, ...chosen.map((m: any) => m.name)].filter(Boolean) as string[];
    onAdd(variant, ids, names);
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
                <Text className="mb-2 text-xs font-bold uppercase text-slate-500">
                  {g.name}{g.is_required ? ' *' : ''}{g.max_select > 1 ? ` (en fazla ${g.max_select})` : ''}
                </Text>
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
            <Pressable onPress={confirm} disabled={missingRequired} className="items-center rounded-xl bg-brand-500 py-3.5 active:opacity-90" style={{ opacity: missingRequired ? 0.5 : 1 }}>
              <Text className="text-sm font-bold text-white">Ekle · {money(price, currency)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
