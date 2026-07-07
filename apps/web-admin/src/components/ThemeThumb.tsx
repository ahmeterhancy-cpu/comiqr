/**
 * Minyatür QR menü teması önizlemesi (classic / flipbook / modern). Hem işletme
 * ayar formunda hem süperadmin tasarım galerisinde kullanılır — tek kaynak.
 */
export function ThemeThumb({ theme }: { theme: string }) {
  if (theme === 'classic') {
    return (
      <svg viewBox="0 0 150 210" className="h-auto w-full rounded-md">
        <rect width="150" height="210" rx="6" fill="#ffffff" />
        <rect x="0" y="0" width="150" height="92" fill="#c98b62" />
        <rect x="0" y="66" width="150" height="26" fill="#00000022" />
        <rect x="12" y="56" width="36" height="36" rx="5" fill="#ffffff" />
        <circle cx="30" cy="74" r="12" fill="#e0b48a" />
        <rect x="54" y="66" width="66" height="8" rx="2" fill="#2b2620" />
        <rect x="54" y="79" width="82" height="4" rx="2" fill="#b9b0a4" />
        <rect x="12" y="104" width="120" height="4" rx="2" fill="#cfc7bb" />
        <rect x="12" y="124" width="48" height="7" rx="2" fill="#7a6f5e" />
        <rect x="12" y="140" width="126" height="4" rx="2" fill="#e6e0d6" />
        <rect x="12" y="149" width="120" height="4" rx="2" fill="#e6e0d6" />
        <rect x="12" y="158" width="112" height="4" rx="2" fill="#e6e0d6" />
      </svg>
    );
  }
  if (theme === 'flipbook') {
    return (
      <svg viewBox="0 0 150 210" className="h-auto w-full rounded-md">
        <rect width="150" height="210" rx="6" fill="#f3ede2" />
        <rect x="8" y="8" width="134" height="34" rx="3" fill="#cbb89a" />
        <rect x="18" y="48" width="114" height="154" fill="#ffffff" stroke="#e2dccf" />
        <rect x="18" y="48" width="14" height="154" fill="#2e7d4f" />
        <rect x="118" y="48" width="14" height="154" fill="#c0392b" />
        <rect x="47" y="62" width="56" height="22" fill="none" stroke="#2b2620" strokeWidth="1.4" />
        <rect x="54" y="69" width="42" height="8" rx="1" fill="#2b2620" />
        <rect x="58" y="96" width="34" height="5" rx="1" fill="#2b2620" />
        {[110, 122, 134, 146, 158, 170].map((y) => (
          <g key={y}>
            <rect x="40" y={y} width="42" height="3.5" rx="1" fill="#8a8074" />
            <rect x="98" y={y} width="12" height="3.5" rx="1" fill="#8a8074" />
          </g>
        ))}
      </svg>
    );
  }
  // modern
  return (
    <svg viewBox="0 0 150 210" className="h-auto w-full rounded-md">
      <rect width="150" height="210" rx="6" fill="#eef1f6" />
      <rect x="0" y="0" width="150" height="18" fill="#3b5bdb" />
      <rect x="8" y="7" width="13" height="2" rx="1" fill="#ffffff" />
      <rect x="8" y="11" width="13" height="2" rx="1" fill="#ffffff" />
      <rect x="0" y="18" width="150" height="52" fill="#c98b62" />
      <rect x="12" y="30" width="30" height="30" rx="4" fill="#ffffff" />
      <circle cx="27" cy="45" r="9" fill="#e0b48a" />
      <rect x="50" y="34" width="62" height="7" rx="2" fill="#ffffff" />
      <rect x="50" y="46" width="76" height="4" rx="2" fill="#ffffffcc" />
      {[84, 122, 160].map((y) => (
        <g key={y}>
          <rect x="10" y={y} width="28" height="28" rx="4" fill="#d8b48f" />
          <rect x="44" y={y + 3} width="52" height="6" rx="2" fill="#2b2620" />
          <rect x="44" y={y + 13} width="66" height="3.5" rx="2" fill="#9aa2ad" />
          <rect x="44" y={y + 20} width="58" height="3.5" rx="2" fill="#9aa2ad" />
          <rect x="112" y={y + 4} width="28" height="12" rx="6" fill="none" stroke="#3b5bdb" strokeWidth="1.3" />
        </g>
      ))}
    </svg>
  );
}
