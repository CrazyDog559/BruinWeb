import Link from 'next/link';
import { ArrowRight, GraduationCap } from 'lucide-react';

import { LectureBrowser } from '@/components/filters/LectureBrowser';
import { LectureCard } from '@/components/media/LectureCard';
import { Container, Section } from '@/components/layout/Section';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { Badge } from '@/components/ui/Badge';
import { ACTIVE_LECTURE_SOURCES } from '@/lib/config/lecture-sources';
import { SOURCES } from '@/lib/config/sources';
import { lectureSlug } from '@/lib/adapters/lectures';
import { getSnapshot } from '@/lib/data/load';
import { formatDate, formatTime } from '@/lib/normalize';

export const metadata = {
  title: 'Public lectures',
  description:
    'Publicly available lectures, seminars, panels and academic talks from UCLA centres and institutes.',
};

export default async function LecturesPage() {
  const { lectures } = await getSnapshot();
  const all = lectures.lectures;

  const hrefFor = Object.fromEntries(
    all.map((lecture) => [lecture.id, `/lectures/${lectureSlug(lecture)}`]),
  );
  const featured = all.slice(0, 3);
  const okSources = lectures.sources.filter((source) => source.status === 'ok').length;

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow text-[var(--ink-faint)]">
          {all.length} talks · {okSources} of {ACTIVE_LECTURE_SOURCES.length} sources live
        </p>
        <h1 className="font-display mt-2 text-3xl sm:text-5xl">Public UCLA lectures</h1>
        <p className="mt-3 max-w-3xl text-[var(--ink-muted)]">
          Lectures, seminars, panels and academic talks that UCLA centres and institutes publish
          openly. Everything here is free to watch or listen to without signing in. Each talk is
          labelled with the format its own publisher gives it, and links back to that publisher —
          BruinWeb stores the description and the link, never the recording.
        </p>
      </header>

      {all.length === 0 ? (
        <div className="surface rounded-[var(--radius-card)] p-10 text-center">
          <h2 className="font-display text-xl">No lectures available</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-muted)]">
            None of the configured lecture feeds could be reached when this site was last built.
          </p>
        </div>
      ) : (
        <>
          {featured.length > 0 ? (
            <Section title="Recently published" description="The newest talks across every source.">
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {featured.map((lecture, index) => (
                  <li key={lecture.id} className="min-w-0">
                    <LectureCard
                      lecture={lecture}
                      href={hrefFor[lecture.id]}
                      priority={index === 0}
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <section aria-labelledby="browse-all" className="pt-4">
            <h2 id="browse-all" className="font-display mb-6 text-2xl sm:text-3xl">
              Browse every talk
            </h2>
            <LectureBrowser lectures={all} hrefFor={hrefFor} />
          </section>
        </>
      )}

      <section aria-labelledby="panopto-note" className="mt-16">
        <div className="surface flex flex-col gap-4 rounded-[var(--radius-card)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <GraduationCap
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-[var(--ink-faint)]"
            />
            <div>
              <h2 id="panopto-note" className="font-display text-lg">
                Panopto course recordings — coming later
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)]">
                The talks above are public. UCLA&rsquo;s institution-hosted course recordings are a
                separate, unbuilt integration, and BruinWeb does not provide access to private
                course material.
              </p>
            </div>
          </div>
          <Link
            href={`/source/${SOURCES.lectures.slug}`}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            See the template
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="sources" className="mt-12 border-t border-[var(--border)] pt-8">
        <h2 id="sources" className="font-display text-xl">
          Where these come from
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {ACTIVE_LECTURE_SOURCES.map((source) => {
            const status = lectures.sources.find((entry) => entry.sourceId === source.id);
            return (
              <li key={source.id} className="text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <ExternalLink
                    href={source.homepage}
                    publisher={source.name}
                    className="font-semibold hover:underline"
                  >
                    {source.name}
                  </ExternalLink>
                  <Badge tone={status?.status === 'ok' ? 'accent' : 'warn'}>
                    {status?.status === 'ok'
                      ? `${status.count} talks`
                      : (status?.status ?? 'unknown')}
                  </Badge>
                </p>
                <p className="mt-1 text-[var(--ink-muted)]">{source.department}</p>
                <p className="mt-1 text-xs text-[var(--ink-faint)]">{source.affiliation}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-xs text-[var(--ink-faint)]">
          Retrieved {formatDate(lectures.generatedAt)} at {formatTime(lectures.generatedAt)} PT.
          Metadata and links only — audio and video stay on each publisher&rsquo;s own site.
        </p>
      </section>
    </Container>
  );
}
