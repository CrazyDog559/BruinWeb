import type { CSSProperties } from 'react';

import { getSource, type SourceConfig } from '@/lib/config/sources';

/**
 * Per-source accent colours are supplied as CSS custom properties and resolved
 * by the `.source-accent` rule in globals.css, which picks the light or dark
 * value based on the active theme. That keeps contrast correct in both themes
 * without duplicating markup.
 */
export function accentVars(source: SourceConfig): CSSProperties {
  return {
    '--accent-light': source.accent.light,
    '--accent-dark': source.accent.dark,
  } as CSSProperties;
}

/**
 * The source's icon and name. Colour is decorative only — the name is always
 * rendered, so nothing is communicated by colour alone.
 */
export function SourceChip({ sourceId, className = '' }: { sourceId: string; className?: string }) {
  const source = getSource(sourceId);
  if (!source) return null;

  const { Icon } = source;

  return (
    <span
      className={`eyebrow source-accent inline-flex items-center gap-1.5 ${className}`}
      style={accentVars(source)}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {source.shortName}
    </span>
  );
}
