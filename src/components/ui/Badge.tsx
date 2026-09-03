import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'accent' | 'gold' | 'warn';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--bg-subtle)] text-[var(--ink-muted)] border-[var(--border)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)] border-transparent',
  gold: 'bg-gold-300/25 text-gold-700 border-gold-300/60 dark:text-gold-300',
  warn: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
