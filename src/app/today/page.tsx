import { CalendarDays, UtensilsCrossed } from 'lucide-react';

import { Container, Section } from '@/components/layout/Section';
import { MediaCard } from '@/components/media/MediaCard';
import { DiningDayView } from '@/components/media/DiningDayView';
import { SourceStatus } from '@/components/media/SourceStatus';
import { SOURCES } from '@/lib/config/sources';
import { getSnapshot } from '@/lib/data/load';
import { campusDate, formatDate, isCampusToday } from '@/lib/normalize';

export const metadata = {
  title: 'Today at UCLA',
  description: 'Dining service, campus events and Bruin games for today.',
};

export default async function TodayPage() {
  const { results, dining, generatedAt } = await getSnapshot();

  const today = campusDate(new Date(generatedAt));

  const events = (results.events?.items ?? []).filter((item) => isCampusToday(item.startsAt));
  const games = (results.athletics?.items ?? []).filter(
    (item) => item.kind === 'event' && isCampusToday(item.startsAt),
  );

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-4">
        <p className="eyebrow text-[var(--ink-faint)]">
          {formatDate(`${today}T12:00:00Z`)} · Pacific
        </p>
        <h1 className="font-display mt-2 text-3xl sm:text-5xl">Today at UCLA</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">
          What&rsquo;s open, what&rsquo;s on, and who&rsquo;s playing — for the current campus day.
        </p>
      </header>

      <Section
        title="Dining today"
        description="Hours and menus for the residential restaurants."
        href={`/source/${SOURCES.dining.slug}`}
        linkLabel="All dining"
      >
        {dining && results.dining?.status === 'ok' ? (
          <DiningDayView day={dining} />
        ) : (
          <SourceStatus source={SOURCES.dining} result={results.dining} />
        )}
      </Section>

      <Section
        title="Campus events"
        description={SOURCES.events.blurb}
        href={`/source/${SOURCES.events.slug}`}
      >
        {events.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((item) => (
              <li key={item.id} className="min-w-0">
                <MediaCard item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyDay
            Icon={CalendarDays}
            message="No featured campus events are scheduled for today. UCLA's highlights list is curated, so quieter days are normal."
          />
        )}
      </Section>

      <Section
        title="Bruin games"
        description="Varsity events scheduled for today."
        href={`/source/${SOURCES.athletics.slug}`}
      >
        {games.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {games.map((item) => (
              <li key={item.id} className="min-w-0">
                <MediaCard item={item} variant="compact" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyDay
            Icon={UtensilsCrossed}
            message="No UCLA varsity events are scheduled for today."
          />
        )}
      </Section>
    </Container>
  );
}

function EmptyDay({ Icon, message }: { Icon: typeof CalendarDays; message: string }) {
  return (
    <div className="surface flex items-start gap-4 rounded-[var(--radius-card)] p-6">
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--ink-faint)]" />
      <p className="text-sm text-[var(--ink-muted)]">{message}</p>
    </div>
  );
}
