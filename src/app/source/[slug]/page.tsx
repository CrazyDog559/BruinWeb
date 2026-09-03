import { notFound } from 'next/navigation';

import { BrowseExplorer } from '@/components/filters/BrowseExplorer';
import { DiningDayView } from '@/components/media/DiningDayView';
import { LectureTemplate } from '@/components/media/LectureTemplate';
import { SourceFooterNote, SourceStatus } from '@/components/media/SourceStatus';
import { Container } from '@/components/layout/Section';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { Badge } from '@/components/ui/Badge';
import {
  ESPORTS_SOCIALS,
  RETRIEVAL_LABELS,
  SOURCE_LIST,
  getSourceBySlug,
} from '@/lib/config/sources';
import { getSnapshot } from '@/lib/data/load';
import { EMPTY_FILTERS } from '@/lib/search';

/** One static page per configured source. */
export function generateStaticParams() {
  return SOURCE_LIST.map((source) => ({ slug: source.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const source = getSourceBySlug(slug);
  if (!source) return {};
  return { title: source.name, description: source.blurb };
}

export default async function SourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const source = getSourceBySlug(slug);
  if (!source) notFound();

  const { results, dining } = await getSnapshot();
  const result = results[source.id];
  const items = result?.items ?? [];

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8 border-b border-[var(--border)] pb-8">
        <p className="eyebrow inline-flex items-center gap-1.5 text-[var(--accent)]">
          <source.Icon aria-hidden="true" className="size-3.5" />
          Channel
        </p>
        <h1 className="font-display mt-2 text-3xl sm:text-5xl">{source.name}</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">{source.blurb}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge tone={result?.status === 'ok' ? 'accent' : 'warn'}>
            {RETRIEVAL_LABELS[source.retrieval]}
          </Badge>
          <Badge>{source.updateFrequency}</Badge>
          <ExternalLink
            href={source.homepage}
            publisher={source.name}
            className="ml-1 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            Official site
          </ExternalLink>
        </div>

        <p className="mt-5 max-w-3xl rounded-lg bg-[var(--bg-subtle)] p-4 text-sm text-[var(--ink-muted)]">
          <strong className="font-semibold text-[var(--ink)]">How this works: </strong>
          {source.integrationNote}
        </p>
      </header>

      {source.id === 'esports' ? (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <span className="eyebrow text-[var(--ink-faint)]">Official accounts</span>
          {ESPORTS_SOCIALS.map((social) => (
            <ExternalLink
              key={social.label}
              href={social.url}
              publisher={social.label}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              {social.handle}
            </ExternalLink>
          ))}
        </div>
      ) : null}

      {source.id === 'dining' && dining && result?.status === 'ok' ? (
        <section aria-labelledby="dining-today">
          <h2 id="dining-today" className="font-display mb-5 text-2xl">
            Dining halls today
          </h2>
          <DiningDayView day={dining} />
        </section>
      ) : source.id === 'lectures' ? (
        <LectureTemplate items={items} result={result} source={source} showNote={false} />
      ) : result?.status === 'ok' && items.length > 0 ? (
        <BrowseExplorer
          items={items}
          heading={source.name}
          initialFilters={{ ...EMPTY_FILTERS, sources: [source.id] }}
        />
      ) : (
        <SourceStatus source={source} result={result} showNote={false} />
      )}

      <div className="mt-12 border-t border-[var(--border)] pt-6">
        <SourceFooterNote source={source} result={result} />
      </div>
    </Container>
  );
}
