'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MediaCard } from '@/components/media/MediaCard';
import { ageInMinutes, formatAgePhrase } from '@/lib/config/refresh';
import { LIVE_SOURCE_IDS, markRefreshed, refreshMany, shouldRefresh } from '@/lib/live';
import { dedupeItems, sortByDateDesc } from '@/lib/normalize';
import type { MediaItem } from '@/lib/types';

/**
 * A mixed feed that quietly brings itself up to date when the page is opened.
 *
 * The homepage river is built from every source, most of which a browser cannot
 * fetch — dining and the lecture feeds send no CORS headers. So rather than
 * replacing the list, live items are merged *over* it: anything newer from a
 * browser-refreshable publisher joins the river, the built items stay, and
 * deduplication keeps a story from appearing twice when both versions exist.
 *
 * The result is a front page that is current on arrival without waiting for a
 * rebuild, and that degrades to exactly the built list if every publisher is
 * unreachable or JavaScript is off.
 */
export function LiveRiver({
  items,
  builtAt,
  limit,
}: {
  items: MediaItem[];
  builtAt: string;
  limit: number;
}) {
  const [live, setLive] = useState<{ items: MediaItem[]; at: string } | null>(null);
  const started = useRef(false);

  const refresh = useCallback(async () => {
    const due = LIVE_SOURCE_IDS.filter((id) => shouldRefresh(id));
    if (due.length === 0) return;

    const { items: fetched, refreshed } = await refreshMany(due);
    for (const id of refreshed) markRefreshed(id);
    if (fetched.length === 0) return;

    setLive({ items: fetched, at: new Date().toISOString() });
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    /*
     * Fetching on mount is exactly what an effect is for, and there is no way
     * to reach a publisher's API without one. Nothing is set synchronously —
     * the update lands only once the requests resolve.
     */
    void refresh();
  }, [refresh]);

  const shown = useMemo(() => {
    if (!live) return items.slice(0, limit);

    // Live items come first so they win deduplication against their built
    // counterparts, then the whole river is re-sorted by publication date.
    const merged = dedupeItems([...sortByDateDesc(live.items), ...items]);
    return sortByDateDesc(merged).slice(0, limit);
  }, [items, limit, live]);

  const freshCount = useMemo(() => {
    if (!live) return 0;
    const built = new Set(items.map((item) => item.url));
    return shown.filter((item) => !built.has(item.url)).length;
  }, [items, live, shown]);

  const stamp = live?.at ?? builtAt;

  return (
    <div>
      <p className="mb-4 text-xs text-[var(--ink-faint)]" suppressHydrationWarning>
        {live ? 'Refreshed in your browser' : 'Updated'} {formatAgePhrase(ageInMinutes(stamp))}
        {freshCount > 0 ? ` · ${freshCount} new since this page was built` : ''}
      </p>

      <p aria-live="polite" className="sr-only">
        {freshCount > 0 ? `${freshCount} new items loaded.` : ''}
      </p>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => (
          <li key={item.id} className="min-w-0">
            <MediaCard item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
