<!doctype html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <style>
        /* dompdf-güvenli CSS: flexbox/columns/color-mix YOK — tablo tabanlı düzen. */
        @page { margin: 14mm; }
        body { font-family: "DejaVu Serif", serif; font-size: 11pt; color: #1a1a1a; }
        .head { text-align: center; border-bottom: 2px solid {{ $brand }}; padding-bottom: 8px; margin-bottom: 14px; }
        .head h1 { color: {{ $brand }}; font-size: 22pt; margin: 0; }
        .head .sub { font-style: italic; color: #555555; font-size: 11pt; margin: 2px 0 0; }
        .head .meta { color: #888888; font-size: 9pt; margin: 4px 0 0; }
        .cat { margin-bottom: 12px; }
        .cat h2 { color: {{ $brand }}; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px;
                  border-bottom: 1px solid #dddddd; padding-bottom: 2px; margin: 0 0 6px; }
        table.items { width: 100%; border-collapse: collapse; }
        table.items td { vertical-align: top; padding: 3px 0; }
        td.name { font-weight: bold; }
        td.price { text-align: right; white-space: nowrap; font-weight: bold; width: 100px; }
        .desc { color: #666666; font-size: 9pt; font-weight: normal; margin-top: 1px; }
        .variants { color: {{ $brand }}; font-size: 9pt; font-weight: bold; margin-top: 1px; }
        .age { color: #b00000; font-size: 7pt; border: 1px solid #b00000; padding: 0 2px; }
        .foot { text-align: center; color: #aaaaaa; font-size: 8pt; margin-top: 18px; border-top: 1px solid #eeeeee; padding-top: 6px; }
    </style>
</head>
<body>
    <div class="head">
        <h1>{{ $venue['name'] }}</h1>
        @if(!empty($venue['sub_title']))<p class="sub">{{ $venue['sub_title'] }}</p>@endif
        @php $meta = trim(implode('  ·  ', array_filter([$venue['address'] ?? null, $venue['timing'] ?? null]))); @endphp
        @if($meta)<p class="meta">{{ $meta }}</p>@endif
    </div>

    @foreach($categories as $c)
        <div class="cat">
            <h2>{{ $c['name'] }}</h2>
            <table class="items">
                @foreach($c['items'] as $it)
                    <tr>
                        <td class="name">
                            {{ $it['name'] }}@if($it['age']) <span class="age">18+</span>@endif
                            @if(!empty($it['desc']))<div class="desc">{{ $it['desc'] }}</div>@endif
                            @if(!empty($it['variants']))<div class="variants">{{ $it['variants'] }}</div>@endif
                        </td>
                        <td class="price">{{ $it['price'] }}</td>
                    </tr>
                @endforeach
            </table>
        </div>
    @endforeach

    <div class="foot">{{ $venue['name'] }} · ComiQR ile hazırlandı</div>
</body>
</html>
