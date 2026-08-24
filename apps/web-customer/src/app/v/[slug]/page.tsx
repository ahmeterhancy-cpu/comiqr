import { permanentRedirect } from 'next/navigation';

/**
 * Legacy in-app venue URL. The canonical address is now the bare slug
 * (comiqr.com/{slug}), so this only forwards — permanently, and with the query
 * string intact, because the admin menu builder previews through here with
 * ?preview=1&theme=…&locale=….
 */
export default async function LegacyVenuePathRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const qs = query.toString();
  permanentRedirect(qs ? `/${slug}?${qs}` : `/${slug}`);
}
