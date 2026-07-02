'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function Result() {
  const params = useSearchParams();
  const status = params.get('status');
  const order = params.get('order');
  const paid = status === 'paid';

  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <div
        className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl ${
          paid ? 'bg-sage-bg' : 'bg-red-50'
        }`}
      >
        {paid ? '✓' : '✕'}
      </div>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        {paid ? 'Ödemeniz alındı' : 'Ödeme tamamlanamadı'}
      </h1>
      {order && <p className="mt-1 text-sm text-muted">Sipariş #{order}</p>}
      <p className="mt-3 text-sm text-muted">
        {paid ? 'Siparişiniz hazırlanıyor, teşekkürler.' : 'Ödeme başarısız oldu. Lütfen tekrar deneyin.'}
      </p>
    </div>
  );
}

export default function OrderResultPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-muted">…</div>}>
      <Result />
    </Suspense>
  );
}
