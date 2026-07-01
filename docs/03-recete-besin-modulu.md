# 03 — Reçete & Besin Değeri Motoru (Derin Tasarım) ⭐

Bu, ürünün ayrıştırıcı çekirdeğidir. Amaç: **her yemeğin reçetesi sisteme
işlenir; kalori, besin değeri ve alerjen bilgisi otomatik hesaplanıp menüde
detayında gösterilir.** Aynı reçete verisi maliyet, stok ve AI'ı da besler.

## 3.1 Kavramsal model

```
Malzeme (Ingredient)  ──< 100g besin verisi + alerjen + birim maliyet
      ▲
      │ (miktar ile)
Reçete Kalemi (RecipeItem)
      ▲
      │
Reçete (Recipe) ──── 1:1 ──── Ürün (Product)
      │
      ▼ (hesaplama motoru)
Besin Özeti (NutritionSummary)  →  Menüde gösterim + Diyet filtreleri
Maliyet Özeti (CostSummary)     →  Menü mühendisliği + fiyat önerisi
Stok Hareketi                    →  Sipariş anında malzeme düşümü
```

## 3.2 Veri modeli (özet — tam şema `docs/05`)

**ingredients** (malzeme ana kartı, tenant bazlı)
- `id, tenant_id, name, unit` (g | ml | adet)
- Besin (100g/100ml başına): `kcal, protein_g, carb_g, fat_g, saturated_fat_g, sugar_g, fiber_g, sodium_mg`
- `unit_cost` (birim maliyet), `cost_unit` (ör. TL/kg), `waste_pct` (fire %)
- `is_vegan, is_vegetarian, is_gluten_free` (bayrak — filtreleme türetimi için)
- `stock_qty` (opsiyonel — stok modülü), `low_stock_threshold`
- `data_source` (manual | usda | tuber | ai_estimated), `verified_at`

**allergens** (referans, 14 EU alerjeni + genişletilebilir)
- `id, code` (gluten, crustaceans, eggs, fish, peanuts, soybeans, milk, nuts, celery, mustard, sesame, sulphites, lupin, molluscs), `name`, `icon`

**ingredient_allergen** (çoktan-çoğa)
- `ingredient_id, allergen_id, trace` (bool — "iz miktarda içerebilir")

**recipes**
- `id, tenant_id, product_id, yield_portions` (kaç porsiyon), `prep_minutes`, `notes`, `updated_at`

**recipe_items**
- `id, recipe_id, ingredient_id, quantity, unit` (malzeme birimiyle uyumlu)
- Not: quantity, `yield_portions` için toplam; porsiyon başına hesap motorda bölünür.

**nutrition_summaries** (türetilmiş, cache — reçete değişince yeniden hesap)
- `id, product_id, per_portion_kcal, protein_g, carb_g, fat_g, saturated_fat_g, sugar_g, fiber_g, sodium_mg`
- `allergen_ids_json` (ürünün türetilmiş alerjen listesi)
- `diet_flags_json` (vegan/vegetarian/gluten_free — reçeteden türetilmiş)
- `cost_per_portion, suggested_price, margin_pct`
- `computed_at, is_stale`

## 3.3 Hesaplama motoru (kritik iş kuralı — birim testli olmalı)

Bir `product` için besin özeti şöyle hesaplanır:

```
Girdi: recipe (yield_portions = P), recipe_items[]
Her item için:
  qty_base = item.quantity        // reçetenin tamamı için (P porsiyonluk)
  qty_effective = qty_base * (1 + ingredient.waste_pct/100)  // fire dahil (maliyet için)
  factor = qty_base_in_100g_units // malzeme birimi g/ml ise: item.quantity / 100
           // adet ise: gram karşılığı tanımlı olmalı (ingredient.grams_per_unit)
  Her besin alanı için:
    total_nutrient += ingredient.nutrient_per_100 * factor

per_portion_nutrient = total_nutrient / P

Alerjen listesi = ∪ (her ingredient'ın allergen_id'leri)   // birleşim
Diyet bayrakları:
  is_vegan       = TÜM ingredient.is_vegan == true
  is_vegetarian  = TÜM ingredient.is_vegetarian == true
  is_gluten_free = TÜM ingredient.is_gluten_free == true

Maliyet:
  cost_per_portion = Σ (qty_effective_in_cost_unit * ingredient.unit_cost) / P
  suggested_price  = cost_per_portion / target_food_cost_ratio  // örn 0.30
  margin_pct       = (product.price - cost_per_portion) / product.price * 100
```

**Kurallar**
- Birim uyumu zorunlu: `recipe_item.unit`, `ingredient.unit` ile uyumlu olmalı; `adet` ise `ingredient.grams_per_unit` tanımlı olmalı, yoksa hata.
- Modifier'lar besin/maliyeti etkileyebilir: bir modifier bir `ingredient`'a bağlıysa (opsiyonel) seçildiğinde besin/maliyet artışı ürün detayında dinamik gösterilebilir **[V2]**.
- Hesap her reçete/malzeme değişiminde **queue job** ile yeniden yapılır (`RecomputeNutrition`), sonucu `nutrition_summaries`'e yazar, `is_stale=false`.
- Menü okuması cache'ten (`nutrition_summaries`) yapılır; canlı hesap yapılmaz (performans).

## 3.4 Menüde gösterim (müşteri PWA)

Ürün detay kartında:
- **Kalori rozeti** (ör. "420 kcal") — liste görünümünde bile küçük rozet.
- **Makro dağılımı** — protein / karbonhidrat / yağ (bar veya daire).
- **Alerjen ikonları** — içerdiği alerjenler ikon + "içerir: süt, gluten"; iz miktar ayrı gösterilir.
- **Diyet rozetleri** — Vegan / Vejetaryen / Glutensiz (reçeteden otomatik).
- Genişlet: tam besin tablosu (doymuş yağ, şeker, lif, sodyum).
- **Filtre çubuğu** — müşteri "vegan", "glutensiz", "<500 kcal" filtreler (V2).

İşletme, besin gösterimini ürün/kategori bazında **açıp kapatabilmeli** (bazı
işletmeler göstermek istemeyebilir). Varsayılan: açık.

## 3.5 Veri girişi & doldurma yolları

İşletmenin işini kolaylaştırmak kritik (aksi halde modül kullanılmaz):

1. **Manuel** — malzeme kartı + reçete elle girilir.
2. **Malzeme kütüphanesi** — sistemde hazır, doğrulanmış malzeme veri tabanı (ör. USDA FoodData Central / Türkiye TÜBER referansı). İşletme "dana kıyma" seçer, besin otomatik gelir; sadece miktar girer. **[V2]**
3. **AI besin tahmini** — malzeme kütüphanede yoksa AI (Anthropic) ürün adı/malzemesinden tahmini besin üretir, `data_source=ai_estimated` işaretlenir, işletme onaylar. **[V3]**
4. **Toplu içe aktarma** — Excel ile malzeme + reçete. **[V2]**

> Yasal not: `ai_estimated` veya `manual` veriler "tahmini değerdir" ibaresiyle
> gösterilmeli. Doğrulanmış (`usda/tuber`) veriler rozetlenebilir.

## 3.6 Diğer modüllere bağlantı

- **Menü mühendisliği (M7 AI)** — `cost_per_portion` + popülerlik → yıldız/at/bilmece/beygir matrisi.
- **Stok (M2/V2)** — sipariş onaylanınca `RecipeItem` miktarları `ingredient.stock_qty`'den düşülür; eşik altına inince uyarı + otomatik 86 önerisi.
- **Dinamik fiyat (M8)** — maliyet artışında marj koruma uyarısı.
- **AI öneri (M7)** — "daha hafif alternatif" veya diyet filtresiyle uyumlu öneri reçete verisinden beslenir.

## 3.7 Kabul kriterleri (MVP)

- [ ] Malzeme kartı oluşturulabiliyor (besin + alerjen + maliyet).
- [ ] Ürüne reçete bağlanıp malzeme + miktar eklenebiliyor.
- [ ] Reçete kaydında porsiyon başına kalori/makro/alerjen doğru hesaplanıyor (birim testli).
- [ ] Besin özeti menü detayında gösteriliyor (kalori rozeti + makro + alerjen ikonları).
- [ ] Diyet bayrakları reçeteden otomatik türetiliyor.
- [ ] İşletme besin gösterimini ürün bazında aç/kapat yapabiliyor.
- [ ] Reçete/malzeme değişiminde besin özeti otomatik yeniden hesaplanıyor (queue).
