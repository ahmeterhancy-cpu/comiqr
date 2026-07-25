/**
 * "HH:MM" (device-local) from an API ISO timestamp. Normalises the 6-digit
 * microsecond fraction Laravel emits (Hermes' Date can't parse `.000000`).
 */
export function hhmm(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.replace(/\.\d+/, ''));
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
