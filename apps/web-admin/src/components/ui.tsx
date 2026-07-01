'use client';

import { forwardRef } from 'react';

export function Button({
  children,
  loading,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
      : 'bg-white text-ink border border-line hover:bg-canvas';
  return (
    <button className={`${base} ${styles} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ${className}`}
        {...props}
      />
    );
  },
);

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Brand({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-white font-bold">
        {name.charAt(0)}
      </span>
      <span className="text-lg font-bold tracking-tight text-ink">{name}</span>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
