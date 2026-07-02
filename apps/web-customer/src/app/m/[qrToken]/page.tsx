import { notFound } from 'next/navigation';
import { OrderableMenu } from '@/components/orderable-menu';
import { fetchMenuByToken } from '@/lib/menu';

/**
 * Menu reached by scanning a table QR (M3/M4/M5/M8, docs/06 §6.2/§6.3/§6.4).
 * Live menu + nutrition, cart + ordering, coupon + loyalty phone + pay, plus
 * call-waiter / request-bill and a language switch.
 */
export default async function ScannedMenuPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  const menu = await fetchMenuByToken(qrToken);

  if (!menu) {
    notFound();
  }

  return <OrderableMenu menu={menu} qrToken={qrToken} tableCode={menu.table?.code} />;
}
