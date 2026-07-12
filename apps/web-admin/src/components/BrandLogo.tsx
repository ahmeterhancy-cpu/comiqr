/**
 * ComiQR brand logo lockup (public/comiqr-logo.png). Single source so every
 * surface — auth, panel sidebar, POS login, marketing — uses the same asset.
 * The mark has dark text, so on dark backgrounds wrap it in a light chip.
 */
export function BrandLogo({ className = 'h-9 w-auto' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/comiqr-logo.png" alt="ComiQR — Cebinizdeki Menü" className={className} />
  );
}
