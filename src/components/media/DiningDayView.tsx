'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, ChevronDown, Clock, Leaf, UtensilsCrossed } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { ExternalLink } from '@/components/ui/ExternalLink';
import {
  CATEGORY_DISPLAY_ORDER,
  MENU_CATEGORY_LABELS,
  labelKind,
  type MenuCategoryKind,
} from '@/lib/config/dining-menu';
import {
  getCampusDayServerSnapshot,
  getCampusDaySnapshot,
  subscribeToCampusDay,
} from '@/lib/clock';
import { formatDate, formatTime } from '@/lib/normalize';
import {
  MEAL_PERIOD_LABELS,
  type DiningDay,
  type DiningMenuItem,
  type DiningVenue,
  type MealPeriod,
} from '@/lib/types';

/** Turn "14:30" into "2:30 PM" without pulling in a date library. */
function displayTime(value: string): string {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${suffix}`;
}

/** Dietary and allergen labels, shown exactly as UCLA publishes them. */
function DishLabels({ tags }: { tags: string[] }) {
  const diets = tags.filter((tag) => labelKind(tag) === 'diet');
  const allergens = tags.filter((tag) => labelKind(tag) === 'allergen');

  if (diets.length === 0 && allergens.length === 0) return null;

  return (
    <span className="ml-1.5 inline-flex flex-wrap items-center gap-1 align-middle">
      {diets.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 text-[0.6875rem] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <Leaf aria-hidden="true" className="size-2.5" />
          {tag}
        </span>
      ))}
      {allergens.length > 0 ? (
        <span className="text-[0.6875rem] text-[var(--ink-faint)]">
          {/* UCLA's own allergen labelling, restated verbatim — no claim of our own. */}
          Contains {allergens.join(', ').toLowerCase()}
        </span>
      ) : null}
    </span>
  );
}

function Dish({ item, emphasised = false }: { item: DiningMenuItem; emphasised?: boolean }) {
  return (
    <li className={emphasised ? 'py-1.5' : 'py-0.5'}>
      <span className={emphasised ? 'font-medium text-[var(--ink)]' : 'text-sm text-[var(--ink)]'}>
        {item.url ? (
          <ExternalLink
            href={item.url}
            publisher="UCLA Dining"
            showIcon={false}
            className="hover:underline"
          >
            {item.name}
          </ExternalLink>
        ) : (
          item.name
        )}
      </span>
      {emphasised && item.station ? (
        <span className="ml-1.5 text-xs text-[var(--ink-faint)]">{item.station}</span>
      ) : null}
      <DishLabels tags={item.tags} />
    </li>
  );
}

/** The answer to "what are the main things I can eat right now?". */
function MainCourses({ items }: { items: DiningMenuItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--ink-muted)]">
        No main courses are listed for this meal. The full menu is below.
      </p>
    );
  }

  return (
    <div className="rounded-lg border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-4">
      <h5 className="eyebrow mb-2 flex items-center gap-1.5 text-[var(--accent)]">
        <UtensilsCrossed aria-hidden="true" className="size-3.5" />
        Main courses
        <span className="font-normal normal-case opacity-70">({items.length})</span>
      </h5>
      <ul className="divide-y divide-[var(--border)]">
        {items.map((item) => (
          <Dish key={item.id} item={item} emphasised />
        ))}
      </ul>
    </div>
  );
}

/** The complete menu, grouped by the categories the source published. */
function FullMenu({ items }: { items: DiningMenuItem[] }) {
  const groups = useMemo(() => {
    const byStation = new Map<string, DiningMenuItem[]>();
    for (const item of items) {
      const key = item.station ?? MENU_CATEGORY_LABELS[item.category];
      byStation.set(key, [...(byStation.get(key) ?? []), item]);
    }

    // Order stations by the category most of their dishes fall into, so the
    // substantial stations lead and the condiments trail.
    const rank = (list: DiningMenuItem[]) => {
      const counts = new Map<MenuCategoryKind, number>();
      for (const item of list) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
      return CATEGORY_DISPLAY_ORDER.indexOf(dominant);
    };

    return [...byStation.entries()].sort(
      (a, b) => rank(a[1]) - rank(b[1]) || a[0].localeCompare(b[0]),
    );
  }, [items]);

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {groups.map(([station, list]) => (
        <div key={station}>
          <h5 className="eyebrow mb-1 text-[var(--ink-faint)]">{station}</h5>
          <ul>
            {list.map((item) => (
              <Dish key={item.id} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function VenueCard({
  venue,
  period,
  date,
}: {
  venue: DiningVenue;
  period: MealPeriod | 'all';
  date: string;
}) {
  const hours = venue.hours.filter((entry) => period === 'all' || entry.period === period);
  const sections = venue.menus.filter((section) => period === 'all' || section.period === period);

  return (
    <li className="surface rounded-[var(--radius-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-display text-xl">
          <ExternalLink
            href={venue.url}
            publisher="UCLA Dining"
            className="hover:underline"
            showIcon={false}
          >
            {venue.name}
          </ExternalLink>
        </h4>
        <Badge tone={venue.open ? 'accent' : 'neutral'}>
          {venue.open ? 'Serving today' : 'Closed today'}
        </Badge>
      </div>

      {hours.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--ink-muted)]">
          {hours.map((entry) => (
            <li key={entry.period} className="inline-flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-3.5 text-[var(--ink-faint)]" />
              <span className="font-medium text-[var(--ink)]">
                {MEAL_PERIOD_LABELS[entry.period]}
              </span>
              <span>
                {displayTime(entry.opens)}–{displayTime(entry.closes)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--ink-faint)]">
          {venue.open
            ? 'No service hours published for this meal period.'
            : 'This dining hall is not serving on this date.'}
        </p>
      )}

      {sections.length === 0 ? (
        <p className="mt-4 border-t border-[var(--border)] pt-4 text-sm text-[var(--ink-muted)]">
          UCLA has not published a menu for this selection.
        </p>
      ) : (
        <div className="mt-4 space-y-6 border-t border-[var(--border)] pt-4">
          {sections.map((section) => {
            const mains = section.items.filter((item) => item.isMainCourse);
            const rest = section.items.filter((item) => !item.isMainCourse);

            return (
              <section
                key={section.period}
                aria-label={`${venue.name} ${MEAL_PERIOD_LABELS[section.period]}`}
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h5 className="font-display text-lg">{MEAL_PERIOD_LABELS[section.period]}</h5>
                  <span className="text-xs text-[var(--ink-faint)]">
                    {section.items.length} item{section.items.length === 1 ? '' : 's'}
                  </span>
                </div>

                <MainCourses items={mains} />

                {rest.length > 0 ? (
                  <details className="group mt-3">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-semibold text-[var(--accent)] hover:underline">
                      <ChevronDown
                        aria-hidden="true"
                        className="size-4 transition-transform group-open:rotate-180"
                      />
                      Everything else on the {MEAL_PERIOD_LABELS[section.period].toLowerCase()} menu
                      ({rest.length})
                    </summary>
                    <FullMenu items={rest} />
                  </details>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--ink-faint)]">
        {venue.name} · menu for {formatDate(`${date}T12:00:00Z`)} ·{' '}
        <ExternalLink
          href={venue.url}
          publisher="UCLA Dining"
          className="underline hover:text-[var(--ink-muted)]"
        >
          Official menu
        </ExternalLink>
      </p>
    </li>
  );
}

function FilterButton({
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

export function DiningDayView({
  day,
  fetchedAt,
  fromFallback = false,
}: {
  day: DiningDay;
  fetchedAt?: string;
  /** True when UCLA Dining failed and a previous menu is standing in. */
  fromFallback?: boolean;
}) {
  const [venueId, setVenueId] = useState<string>('all');
  const [period, setPeriod] = useState<MealPeriod | 'all'>('all');

  // Reported as '' during server render, so the stale banner never causes a
  // hydration mismatch; the client fills it in on its first pass.
  const { date: today } = useSyncExternalStore(
    subscribeToCampusDay,
    getCampusDaySnapshot,
    getCampusDayServerSnapshot,
  );
  // Two different kinds of "not current", kept distinct because they call for
  // different reactions: the menu is for another day, versus the publisher was
  // unreachable and this is the last menu we managed to retrieve.
  const isStale = today !== '' && today !== day.date;

  const periods = useMemo(() => {
    const found = new Set<MealPeriod>();
    for (const venue of day.venues) {
      for (const entry of venue.hours) found.add(entry.period);
      for (const section of venue.menus) found.add(section.period);
    }
    return [...found];
  }, [day]);

  const venues = useMemo(
    () => day.venues.filter((venue) => venueId === 'all' || venue.id === venueId),
    [day, venueId],
  );

  return (
    <div>
      {fromFallback ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">UCLA Dining was unreachable.</strong> This is the most
            recent menu that retrieved successfully
            {fetchedAt ? <> — from {formatDate(fetchedAt)}</> : null}. It is shown rather than
            nothing, but check the official menu before relying on it.
          </p>
        </div>
      ) : null}

      {isStale ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">This menu is out of date.</strong> It is the menu for{' '}
            {formatDate(`${day.date}T12:00:00Z`)}, captured when this site was last built. Check the
            official UCLA Dining menu for today&rsquo;s service.
          </p>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-6">
        <fieldset>
          <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Dining hall</legend>
          <div className="flex flex-wrap gap-1.5">
            <FilterButton active={venueId === 'all'} onClick={() => setVenueId('all')}>
              All halls
            </FilterButton>
            {day.venues.map((venue) => (
              <FilterButton
                key={venue.id}
                active={venueId === venue.id}
                onClick={() => setVenueId(venue.id)}
              >
                {venue.name}
              </FilterButton>
            ))}
          </div>
        </fieldset>

        {periods.length > 0 ? (
          <fieldset>
            <legend className="eyebrow mb-2 text-[var(--ink-faint)]">Meal period</legend>
            <div className="flex flex-wrap gap-1.5">
              <FilterButton active={period === 'all'} onClick={() => setPeriod('all')}>
                All meals
              </FilterButton>
              {periods.map((value) => (
                <FilterButton
                  key={value}
                  active={period === value}
                  onClick={() => setPeriod(value)}
                >
                  {MEAL_PERIOD_LABELS[value]}
                </FilterButton>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>

      {venues.length === 0 ? (
        <p className="surface rounded-[var(--radius-card)] p-6 text-sm text-[var(--ink-muted)]">
          No dining halls match this selection.
        </p>
      ) : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} period={period} date={day.date} />
          ))}
        </ul>
      )}

      {fetchedAt ? (
        <p className="mt-5 text-xs text-[var(--ink-faint)]">
          Menus and hours from{' '}
          <ExternalLink
            href="https://dining.ucla.edu/"
            publisher="UCLA Dining"
            className="underline hover:text-[var(--ink-muted)]"
          >
            UCLA Dining
          </ExternalLink>
          , retrieved {formatDate(fetchedAt)} at {formatTime(fetchedAt)} PT. Main courses are
          grouped automatically from the stations UCLA publishes; dietary and allergen labels are
          shown exactly as UCLA supplies them.
        </p>
      ) : null}
    </div>
  );
}
