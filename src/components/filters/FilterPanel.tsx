'use client';

import { Filter, X } from 'lucide-react';

import { NAV_SOURCES } from '@/lib/config/sources';
import { MEDIA_KINDS, type MediaKind } from '@/lib/types';
import { hasActiveFilters, type DateRange, type FilterState } from '@/lib/search';

const KIND_LABELS: Record<MediaKind, string> = {
  article: 'Articles',
  audio: 'Audio',
  video: 'Video',
  publication: 'Publications',
  event: 'Events',
  menu: 'Dining',
  lecture: 'Lectures',
};

const DATE_OPTIONS: Array<{ value: DateRange; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
];

interface FilterPanelProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  categories: string[];
  resultCount: number;
}

/** Toggle a value in one of the array-valued filter fields. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function ChipGroup<T extends string>({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: Array<{ value: T; label: string }>;
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="eyebrow mb-2 text-[var(--ink-faint)]">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FilterPanel({ filters, onChange, categories, resultCount }: FilterPanelProps) {
  const active = hasActiveFilters(filters);

  return (
    <aside aria-label="Filters" className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display inline-flex items-center gap-2 text-lg">
          <Filter aria-hidden="true" className="size-4" />
          Filters
        </h2>
        {active ? (
          <button
            type="button"
            onClick={() =>
              onChange({
                query: filters.query,
                sources: [],
                kinds: [],
                categories: [],
                dateRange: 'any',
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            <X aria-hidden="true" className="size-3" />
            Clear all
          </button>
        ) : null}
      </div>

      <ChipGroup
        legend="Source"
        options={NAV_SOURCES.map((source) => ({ value: source.id, label: source.shortName }))}
        selected={filters.sources}
        onToggle={(value) => onChange({ ...filters, sources: toggle(filters.sources, value) })}
      />

      <ChipGroup
        legend="Media type"
        options={MEDIA_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
        selected={filters.kinds}
        onToggle={(value) => onChange({ ...filters, kinds: toggle(filters.kinds, value) })}
      />

      <fieldset>
        <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Date</legend>
        <div className="flex flex-wrap gap-1.5">
          {DATE_OPTIONS.map((option) => {
            const selected = filters.dateRange === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...filters, dateRange: option.value })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {categories.length > 0 ? (
        <ChipGroup
          legend="Category"
          options={categories
            .slice(0, 24)
            .map((category) => ({ value: category, label: category }))}
          selected={filters.categories}
          onToggle={(value) =>
            onChange({ ...filters, categories: toggle(filters.categories, value) })
          }
        />
      ) : null}

      <p className="border-t border-[var(--border)] pt-4 text-xs text-[var(--ink-faint)]">
        {resultCount} {resultCount === 1 ? 'item' : 'items'} match.
      </p>
    </aside>
  );
}
