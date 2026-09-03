'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import {
  readServerTheme,
  readTheme,
  subscribeToTheme,
  writeTheme,
  type ThemeChoice,
} from '@/lib/theme';

const OPTIONS: Array<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeToggle() {
  // Reads the stored preference directly; no effect, no mount flash.
  const choice = useSyncExternalStore(subscribeToTheme, readTheme, readServerTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            onClick={() => writeTheme(value)}
            className={`rounded-full p-1.5 transition-colors ${
              active
                ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                : 'text-[var(--ink-faint)] hover:text-[var(--ink)]'
            }`}
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
