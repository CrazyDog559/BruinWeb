'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { LectureCard } from '@/components/media/LectureCard';
import {
  EMPTY_LECTURE_FILTERS,
  collectDepartments,
  collectTopics,
  filterLectures,
  hasActiveLectureFilters,
  type DurationBucket,
  type LectureFilterState,
  type LectureSort,
} from '@/lib/lectures/search';
import {
  LECTURE_FORMATS,
  LECTURE_FORMAT_LABELS,
  LECTURE_MEDIA_TYPES,
  type Lecture,
  type LectureFormat,
  type LectureMediaType,
} from '@/lib/types/lecture';

const PAGE_SIZE = 18;

const SORTS: Array<{ value: LectureSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title A–Z' },
];

const DURATIONS: Array<{ value: DurationBucket; label: string }> = [
  { value: 'any', label: 'Any length' },
  { value: 'short', label: 'Under 20 min' },
  { value: 'medium', label: '20–60 min' },
  { value: 'long', label: 'Over an hour' },
];

const DATES: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Any time' },
  { value: 90, label: 'Past 3 months' },
  { value: 365, label: 'Past year' },
  { value: 365 * 3, label: 'Past 3 years' },
];

const MEDIA_LABELS: Record<LectureMediaType, string> = { video: 'Video', audio: 'Audio' };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)]'
          : 'border-[var(--border)] text-[var(--ink-muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]'
      }`}
    >
      {children}
    </button>
  );
}

export function LectureBrowser({
  lectures,
  hrefFor,
}: {
  lectures: Lecture[];
  hrefFor: Record<string, string>;
}) {
  const [filters, setFilters] = useState<LectureFilterState>(EMPTY_LECTURE_FILTERS);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [paged, setPaged] = useState<LectureFilterState>(EMPTY_LECTURE_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const deferred = useDeferredValue(filters);

  const departments = useMemo(() => collectDepartments(lectures), [lectures]);
  const topics = useMemo(() => collectTopics(lectures), [lectures]);
  const results = useMemo(() => filterLectures(lectures, deferred), [lectures, deferred]);

  // Reset paging during render rather than in an effect, so the new results are
  // never briefly shown against the previous page size.
  if (paged !== deferred) {
    setPaged(deferred);
    setVisible(PAGE_SIZE);
  }

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
    <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:gap-10">
      <div className="mb-6 lg:hidden">
        <button
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          aria-expanded={panelOpen}
          aria-controls="lecture-filters"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          {panelOpen ? 'Hide filters' : 'Show filters'}
          {hasActiveLectureFilters(filters) ? (
            <span className="bg-gold-500 size-2 rounded-full" aria-label="filters active" />
          ) : null}
        </button>
      </div>

      <aside
        id="lecture-filters"
        aria-label="Lecture filters"
        className={`${panelOpen ? 'mb-8 block' : 'hidden'} space-y-6 lg:sticky lg:top-32 lg:block lg:self-start`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg">Filters</h2>
          {hasActiveLectureFilters(filters) ? (
            <button
              type="button"
              onClick={() => setFilters({ ...EMPTY_LECTURE_FILTERS, sort: filters.sort })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              <X aria-hidden="true" className="size-3" />
              Clear all
            </button>
          ) : null}
        </div>

        <fieldset>
          <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Format</legend>
          <div className="flex flex-wrap gap-1.5">
            {LECTURE_FORMATS.map((format) => (
              <Chip
                key={format}
                active={filters.formats.includes(format)}
                onClick={() =>
                  setFilters({
                    ...filters,
                    formats: toggle<LectureFormat>(filters.formats, format),
                  })
                }
              >
                {LECTURE_FORMAT_LABELS[format]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Media</legend>
          <div className="flex flex-wrap gap-1.5">
            {LECTURE_MEDIA_TYPES.map((type) => (
              <Chip
                key={type}
                active={filters.mediaTypes.includes(type)}
                onClick={() =>
                  setFilters({
                    ...filters,
                    mediaTypes: toggle<LectureMediaType>(filters.mediaTypes, type),
                  })
                }
              >
                {MEDIA_LABELS[type]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Length</legend>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((option) => (
              <Chip
                key={option.value}
                active={filters.duration === option.value}
                onClick={() => setFilters({ ...filters, duration: option.value })}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Published</legend>
          <div className="flex flex-wrap gap-1.5">
            {DATES.map((option) => (
              <Chip
                key={option.value}
                active={filters.withinDays === option.value}
                onClick={() => setFilters({ ...filters, withinDays: option.value })}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Department</legend>
          <div className="flex flex-wrap gap-1.5">
            {departments.map((department) => (
              <Chip
                key={department}
                active={filters.departments.includes(department)}
                onClick={() =>
                  setFilters({ ...filters, departments: toggle(filters.departments, department) })
                }
              >
                {department.replace(/^UCLA\s+/, '')}
              </Chip>
            ))}
          </div>
        </fieldset>

        {topics.length > 0 ? (
          <fieldset>
            <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Topic</legend>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => (
                <Chip
                  key={topic}
                  active={filters.topics.includes(topic)}
                  onClick={() => setFilters({ ...filters, topics: toggle(filters.topics, topic) })}
                >
                  {topic}
                </Chip>
              ))}
            </div>
          </fieldset>
        ) : null}

        <p className="border-t border-[var(--border)] pt-4 text-xs text-[var(--ink-faint)]">
          {results.length} {results.length === 1 ? 'talk' : 'talks'} match.
        </p>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--ink-faint)]"
            />
            <input
              ref={searchRef}
              type="search"
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              placeholder="Search by title, speaker, department, series or topic…  (press /)"
              aria-label="Search public UCLA lectures"
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

          <label className="flex shrink-0 items-center gap-2 text-sm">
            <span className="text-[var(--ink-muted)]">Sort</span>
            <select
              value={filters.sort}
              onChange={(event) =>
                setFilters({ ...filters, sort: event.target.value as LectureSort })
              }
              className="rounded-full border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p aria-live="polite" className="sr-only">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </p>

        {shown.length === 0 ? (
          <div className="surface rounded-[var(--radius-card)] p-10 text-center">
            <h2 className="font-display text-xl">No talks match</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ink-muted)]">
              Try a broader search, or clear a filter or two.
            </p>
            {hasActiveLectureFilters(filters) ? (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_LECTURE_FILTERS)}
                className="mt-5 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-ink)]"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((lecture, index) => (
                <li key={lecture.id} className="min-w-0">
                  <LectureCard
                    lecture={lecture}
                    href={hrefFor[lecture.id] ?? '/lectures'}
                    priority={index < 3}
                  />
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
