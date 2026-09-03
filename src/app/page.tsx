import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Container, Section } from '@/components/layout/Section';
import { MediaCard } from '@/components/media/MediaCard';
import { SITE, FEED } from '@/lib/config/site';
import { NAV_SOURCES, sourceHref } from '@/lib/config/sources';
import { getSnapshot, pickFeatured } from '@/lib/data/load';
import { isCampusToday } from '@/lib/normalize';
import type { MediaItem } from '@/lib/types';

export const metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
};

/** Today's dining, events and games — the reason to open the site each morning. */
function todayItems(items: MediaItem[]): MediaItem[] {
  return items.filter((item) => {
    if (item.kind === 'menu') return true;
    if (item.kind === 'event') return isCampusToday(item.startsAt);
    return false;
  });
}

export default async function HomePage() {
  const { items, results } = await getSnapshot();

  const featured = pickFeatured(items);
  const [lead, ...rest] = featured;
  const today = todayItems(items).slice(0, 4);

  const featuredIds = new Set(featured.map((item) => item.id));
  const latest = items.filter((item) => !featuredIds.has(item.id)).slice(0, FEED.homepageLatest);

  const liveSources = NAV_SOURCES.filter((source) => results[source.id]?.status === 'ok').length;

  return (
    <>
      {/* Masthead */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <Container className="py-12 sm:py-16">
          <p className="eyebrow text-[var(--ink-faint)]">
            {liveSources} of {NAV_SOURCES.length} channels live ·{' '}
            {SITE.timeZone.split('/')[1].replace('_', ' ')} time
          </p>
          <h1 className="font-display mt-3 max-w-4xl text-4xl leading-[1.05] sm:text-6xl">
            Everything happening at UCLA,{' '}
            <span className="relative whitespace-nowrap text-[var(--accent)]">
              in one place
              <span
                aria-hidden="true"
                className="bg-gold-300 absolute -bottom-1 left-0 h-1.5 w-full rounded-full"
              />
            </span>
            .
          </h1>
          <p className="mt-5 max-w-2xl text-base text-[var(--ink-muted)] sm:text-lg">
            News, radio, publications, dining, events, esports and athletics — gathered from their
            official sources and linked straight back to the people who made them.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/today"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] transition-opacity hover:opacity-90"
            >
              Today at UCLA
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--bg-raised)]"
            >
              Search everything
            </Link>
          </div>
        </Container>
      </div>

      <Container>
        {lead ? (
          <Section
            title="Featured"
            description="Hand-picked from the newest stories across every channel."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <MediaCard item={lead} variant="lead" priority />
              <ul className="grid gap-5 sm:grid-cols-2">
                {rest.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <MediaCard item={item} />
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        ) : null}

        {today.length > 0 ? (
          <Section
            title="Today at UCLA"
            description="Dining service and campus events for today, Pacific time."
            href="/today"
            linkLabel="Full day"
          >
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {today.map((item) => (
                <li key={item.id} className="min-w-0">
                  <MediaCard item={item} variant="compact" />
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section
          title="Latest"
          description="Newest first, deduplicated across sources."
          href="/browse"
          linkLabel="Browse all"
        >
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {latest.map((item) => (
              <li key={item.id} className="min-w-0">
                <MediaCard item={item} />
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Channels"
          description="Every source BruinWeb follows, and how fresh each one is."
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_SOURCES.map((source) => {
              const result = results[source.id];
              const count = result?.items.length ?? 0;
              return (
                <li key={source.id}>
                  <Link
                    href={sourceHref(source)}
                    className="surface flex h-full gap-4 rounded-[var(--radius-card)] p-5 transition-shadow hover:shadow-md"
                  >
                    <source.Icon
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-[var(--accent)]"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-lg">{source.name}</p>
                      <p className="mt-1 text-sm text-[var(--ink-muted)]">{source.blurb}</p>
                      <p className="mt-2.5 text-xs text-[var(--ink-faint)]">
                        {result?.status === 'ok'
                          ? `${count} item${count === 1 ? '' : 's'}`
                          : result?.status === 'placeholder'
                            ? 'Coming soon'
                            : result?.status === 'unavailable'
                              ? 'Not available'
                              : result?.status === 'error'
                                ? 'Source unreachable'
                                : 'Nothing published'}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      </Container>
    </>
  );
}
