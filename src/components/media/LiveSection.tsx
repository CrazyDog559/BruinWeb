'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';

import { MediaCard } from '@/components/media/MediaCard';
import { ageInMinutes, formatAgePhrase } from '@/lib/config/refresh';
import { refreshSource, type LiveSourceId } from '@/lib/live';
import { formatDate, formatTime } from '@/lib/normalize';
import type { MediaItem } from '@/lib/types';

type State =
  | { phase: 'built' }
  | { phase: 'loading' }
  | { phase: 'live'; items: MediaItem[]; at: string; added: number }
  | { phase: 'failed'; message: string };

/**
 * A section that can go and get something newer than the build.
 *
 * The built content renders on the server and is what a reader sees first, so
 * the section is useful with JavaScript disabled and never flashes empty. The
 * refresh replaces it only on success; a failure leaves the built content
 * exactly where it was and says so, because a stale story is far better than a
 * blank column.
 */
export function LiveSection({
  sourceId,
  items,
  builtAt,
  publisher,
  emptyMessage,
}: {
  sourceId: LiveSourceId;
  items: MediaItem[];
  /** When the build retrieved what is on screen now. */
  builtAt: string;
  publisher: string;
  emptyMessage?: string;
}) {
  const [state, setState] = useState<State>({ phase: 'built' });

  const onRefresh = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const result = await refreshSource(sourceId);
      if (result.items.length === 0) {
        setState({ phase: 'failed', message: `${publisher} returned no items.` });
        return;
      }
      const known = new Set(items.map((item) => item.url));
      setState({
        phase: 'live',
        items: result.items,
        at: result.retrievedAt,
        added: result.items.filter((item) => !known.has(item.url)).length,
      });
    } catch (error) {
      setState({
        phase: 'failed',
        message:
          error instanceof Error && error.name === 'AbortError'
            ? `${publisher} took too long to respond.`
            : `Could not reach ${publisher} from your browser.`,
      });
    }
  }, [items, publisher, sourceId]);

  const shown = state.phase === 'live' ? state.items : items;
  const shownAt = state.phase === 'live' ? state.at : builtAt;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--ink-faint)]">
          {state.phase === 'live' ? 'Refreshed in your browser' : 'Updated'}{' '}
          <time dateTime={shownAt} suppressHydrationWarning title={shownAt}>
            {formatDate(shownAt)} at {formatTime(shownAt)} PT
          </time>
          <span suppressHydrationWarning>
            {' · '}
            {formatAgePhrase(ageInMinutes(shownAt))}
          </span>
        </p>

        <button
          type="button"
          onClick={onRefresh}
          disabled={state.phase === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold transition-colors hover:border-[var(--border-strong)] disabled:opacity-60"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-3.5 ${state.phase === 'loading' ? 'animate-spin' : ''}`}
          />
          {state.phase === 'loading' ? 'Checking…' : 'Check for new'}
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {state.phase === 'live'
          ? `Refreshed. ${state.added} new item${state.added === 1 ? '' : 's'}.`
          : state.phase === 'failed'
            ? state.message
            : ''}
      </p>

      {state.phase === 'live' ? (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.added > 0
            ? `${state.added} new item${state.added === 1 ? '' : 's'} straight from ${publisher}.`
            : `Up to date — nothing new since this page was built.`}
        </p>
      ) : null}

      {state.phase === 'failed' ? (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.message} Showing what was retrieved when this page was built.
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className="surface rounded-[var(--radius-card)] p-6 text-sm text-[var(--ink-muted)]">
          {emptyMessage ??
            `Nothing was retrieved from ${publisher} for this build. Use the button above to try from your browser.`}
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item, index) => (
            <li key={item.id} className="min-w-0">
              <MediaCard item={item} priority={index < 3} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
