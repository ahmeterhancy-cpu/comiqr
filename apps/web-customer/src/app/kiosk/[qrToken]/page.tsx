import { notFound } from 'next/navigation';
import { KioskFrame } from '@/components/kiosk-frame';
import { fetchMenuByToken } from '@/lib/menu';

/**
 * Self-service kiosk by table QR token (M16). Same ordering flow as the scanned
 * menu, wrapped in kiosk chrome for a stationary device.
 */
export default async function KioskPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const menu = await fetchMenuByToken(qrToken);

  if (!menu) {
    notFound();
  }

  return <KioskFrame menu={menu} qrToken={qrToken} tableCode={menu.table?.code} />;
}
