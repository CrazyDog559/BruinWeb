'use client';

import { useMemo, useState } from 'react';
import { Clock, Leaf } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { MEAL_PERIOD_LABELS, type DiningDay, type MealPeriod } from '@/lib/types';

/** Turn "14:30" into "2:30 PM" without pulling in a date library. */
function displayTime(value: string): string {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${suffix}`;
}

/** Diet tags worth surfacing prominently; allergens stay in the full list. */
const DIET_TAGS = new Set(['Vegan', 'Vegetarian', 'Halal']);

export function DiningDayView({ day }: { day: DiningDay }) {
  const [venueId, setVenueId] = useState<string>('all');
  const [period, setPeriod] = useState<MealPeriod | 'all'>('all');

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

      <ul className="grid gap-5 lg:grid-cols-2">
        {venues.map((venue) => {
          const hours = venue.hours.filter((entry) => period === 'all' || entry.period === period);
          const menus = venue.menus.filter(
            (section) => period === 'all' || section.period === period,
          );

          return (
            <li key={venue.id} className="surface rounded-[var(--radius-card)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-display text-xl">
                  <ExternalLink
                    href={venue.url}
                    publisher="UCLA Dining"
                    className="hover:underline"
                    showIcon={false}
                  >
                    {venue.name}
                  </ExternalLink>
                </h3>
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
                  No service hours published for this selection.
                </p>
              )}

              {menus.length > 0 ? (
                <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
                  {menus.map((section) => (
                    <div key={section.period}>
                      <h4 className="eyebrow mb-2 text-[var(--ink-faint)]">
                        {MEAL_PERIOD_LABELS[section.period]}
                      </h4>
                      <ul className="space-y-1.5">
                        {section.items.map((item) => (
                          <li key={item.id} className="text-sm">
                            <span className="text-[var(--ink)]">{item.name}</span>
                            {item.station ? (
                              <span className="text-[var(--ink-faint)]"> · {item.station}</span>
                            ) : null}
                            {item.tags
                              .filter((tag) => DIET_TAGS.has(tag))
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[0.6875rem] font-semibold text-emerald-700 dark:text-emerald-400"
                                >
                                  <Leaf aria-hidden="true" className="size-3" />
                                  {tag}
                                </span>
                              ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {venues.length === 0 ? (
        <p className="surface rounded-[var(--radius-card)] p-6 text-sm text-[var(--ink-muted)]">
          No dining halls match this selection.
        </p>
      ) : null}
    </div>
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
