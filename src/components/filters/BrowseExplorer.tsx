'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { FilterPanel } from '@/components/filters/FilterPanel';
import { MediaCard } from '@/components/media/MediaCard';
import {
  collectCategories,
  filterItems,
  hasActiveFilters,
  EMPTY_FILTERS,
  type FilterState,
} from '@/lib/search';
import { isCampusToday } from '@/lib/normalize';
import type { MediaItem } from '@/lib/types';

const PAGE_SIZE = 24;

/**
 * The search-and-filter surface.
 *
 * Everything runs against the build-time snapshot already in memory, so there
 * is no request on keystroke and no backend. `useDeferredValue` keeps typing
 * responsive while the (pure, synchronous) filter pass catches up.
 */
export function BrowseExplorer({
  items,
  initialFilters = EMPTY_FILTERS,
  heading,
}: {
  items: MediaItem[];
  initialFilters?: FilterState;
  heading?: string;
}) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [pagedFilters, setPagedFilters] = useState<FilterState>(initialFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const deferredFilters = useDeferredValue(filters);

  const categories = useMemo(() => collectCategories(items), [items]);

  const results = useMemo(
    () => filterItems(items, deferredFilters, { isToday: (iso) => isCampusToday(iso) }),
    [items, deferredFilters],
  );

  // Reset paging whenever the result set changes shape. Adjusting state during
  // render (rather than in an effect) avoids a second render pass that would
  // briefly show the old page size against the new results.
  if (pagedFilters !== deferredFilters) {
    setPagedFilters(deferredFilters);
    setVisible(PAGE_SIZE);
  }

  // "/" focuses search, the way a reader expects on a news site.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const shown = results.slice(0, visible);

  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
      <div className="mb-6 lg:hidden">
        <button
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          aria-expanded={panelOpen}
          aria-controls="filter-panel"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {panelOpen ? 'Hide filters' : 'Show filters'}
          {hasActiveFilters(filters) ? (
            <span className="bg-gold-500 size-2 rounded-full" aria-label="filters active" />
          ) : null}
        </button>
      </div>

      <div
        id="filter-panel"
        className={`${panelOpen ? 'mb-8 block' : 'hidden'} lg:sticky lg:top-32 lg:block lg:self-start`}
      >
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          categories={categories}
          resultCount={results.length}
        />
      </div>

      <div className="min-w-0">
        <div className="relative mb-6">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--ink-faint)]"
          />
          <input
            ref={searchRef}
            type="search"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            placeholder="Search headlines, dining, events…  (press /)"
            aria-label={heading ? `Search ${heading}` : 'Search all loaded content'}
            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-raised)] py-3.5 pr-12 pl-12 text-base transition-colors outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--ring)]"
          />
          {filters.query ? (
            <button
              type="button"
              onClick={() => {
                setFilters({ ...filters, query: '' });
                searchRef.current?.focus();
              }}
              className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">Clear search</span>
            </button>
          ) : null}
        </div>

        {/* Politely announces result counts to screen readers as filters change. */}
        <p aria-live="polite" className="sr-only">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </p>

        {shown.length === 0 ? (
          <div className="surface rounded-[var(--radius-card)] p-10 text-center">
            <h2 className="font-display text-xl">No matches</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ink-muted)]">
              {items.length === 0
                ? 'No content was available when this site was last built.'
                : 'Try a broader search, or clear a filter or two.'}
            </p>
            {hasActiveFilters(filters) ? (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-5 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-ink)]"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((item, index) => (
                <li key={item.id} className="min-w-0">
                  <MediaCard item={item} priority={index < 3} />
                </li>
              ))}
            </ul>

            {visible < results.length ? (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((value) => value + PAGE_SIZE)}
                  className="rounded-full border border-[var(--border-strong)] px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  Show more ({results.length - visible} remaining)
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
