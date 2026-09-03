import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Headphones,
  Video,
} from 'lucide-react';

import { Container } from '@/components/layout/Section';
import { LectureCard } from '@/components/media/LectureCard';
import { Badge } from '@/components/ui/Badge';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { SmartImage } from '@/components/ui/SmartImage';
import { lectureSlug } from '@/lib/adapters/lectures';
import { getLectureSource } from '@/lib/config/lecture-sources';
import { getSnapshot } from '@/lib/data/load';
import { relatedLectures } from '@/lib/lectures/search';
import { formatDate, formatDuration, formatTime } from '@/lib/normalize';
import { LECTURE_FORMAT_LABELS, type Lecture } from '@/lib/types/lecture';

/** One static page per collected lecture. */
export async function generateStaticParams() {
  const { lectures } = await getSnapshot();
  return lectures.lectures.map((lecture) => ({ slug: lectureSlug(lecture) }));
}

async function findLecture(slug: string): Promise<Lecture | undefined> {
  const { lectures } = await getSnapshot();
  return lectures.lectures.find((lecture) => lectureSlug(lecture) === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const lecture = await findLecture((await params).slug);
  if (!lecture) return {};
  return {
    title: lecture.title,
    description:
      lecture.description ?? `${LECTURE_FORMAT_LABELS[lecture.format]} from ${lecture.department}`,
  };
}

export default async function LectureDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lecture = await findLecture(slug);
  if (!lecture) notFound();

  const { lectures } = await getSnapshot();
  const source = getLectureSource(lecture.sourceId);
  const related = relatedLectures(lecture, lectures.lectures);
  const duration = formatDuration(lecture.durationSeconds);
  const MediaIcon = lecture.mediaType === 'video' ? Video : Headphones;

  return (
    <Container className="py-10 sm:py-14">
      <Link
        href="/lectures"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All public lectures
      </Link>

      <article className="mt-6 grid gap-10 lg:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              <MediaIcon aria-hidden="true" className="size-3" />
              {LECTURE_FORMAT_LABELS[lecture.format]}
            </Badge>
            {lecture.series ? <Badge>{lecture.series}</Badge> : null}
          </div>

          <h1 className="font-display text-3xl leading-tight sm:text-4xl">{lecture.title}</h1>

          {lecture.speaker ? (
            <p className="mt-3 text-lg text-[var(--ink-muted)]">
              {lecture.speaker}
              {lecture.speakerAffiliation ? (
                <span className="text-[var(--ink-faint)]"> · {lecture.speakerAffiliation}</span>
              ) : null}
            </p>
          ) : null}

          {/*
            Embedded playback appears only where the publisher officially
            supports it. Every other source is linked, never reframed.
          */}
          {lecture.embedUrl ? (
            <div className="mt-6 aspect-video overflow-hidden rounded-[var(--radius-card)] bg-black">
              <iframe
                src={lecture.embedUrl}
                title={lecture.title}
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="size-full border-0"
              />
            </div>
          ) : lecture.thumbnailUrl ? (
            <SmartImage
              src={lecture.thumbnailUrl}
              alt=""
              seed={lecture.id}
              aspect="16 / 9"
              priority
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="mt-6 w-full rounded-[var(--radius-card)]"
            />
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <ExternalLink
              href={lecture.watchUrl}
              publisher={lecture.sourceName}
              showIcon={false}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] transition-opacity hover:opacity-90"
            >
              <MediaIcon aria-hidden="true" className="size-4" />
              {lecture.mediaType === 'video' ? 'Watch' : 'Listen'} on {lecture.sourceName}
            </ExternalLink>

            {lecture.transcriptUrl ? (
              <ExternalLink
                href={lecture.transcriptUrl}
                publisher={lecture.sourceName}
                showIcon={false}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
              >
                <FileText aria-hidden="true" className="size-4" />
                Transcript
              </ExternalLink>
            ) : null}
          </div>

          {lecture.description ? (
            <div className="mt-8">
              <h2 className="eyebrow mb-2 text-[var(--ink-faint)]">About this talk</h2>
              {/* Plain text, sanitized at build time — no source HTML is rendered. */}
              <p className="max-w-prose whitespace-pre-line text-[var(--ink-muted)]">
                {lecture.description}
              </p>
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="surface rounded-[var(--radius-card)] p-5">
            <h2 className="eyebrow mb-3 text-[var(--ink-faint)]">Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-3">
                <dt className="shrink-0 text-[var(--ink-faint)]">
                  <Building2 aria-hidden="true" className="size-4" />
                  <span className="sr-only">Department</span>
                </dt>
                <dd className="text-[var(--ink)]">{lecture.department ?? 'Not stated'}</dd>
              </div>

              {lecture.publishedAt ? (
                <div className="flex gap-3">
                  <dt className="shrink-0 text-[var(--ink-faint)]">
                    <CalendarDays aria-hidden="true" className="size-4" />
                    <span className="sr-only">Published</span>
                  </dt>
                  <dd className="text-[var(--ink)]">
                    <time dateTime={lecture.publishedAt}>{formatDate(lecture.publishedAt)}</time>
                    {lecture.recordedAt ? (
                      <span className="block text-[var(--ink-faint)]">
                        Recorded {formatDate(lecture.recordedAt)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}

              {duration ? (
                <div className="flex gap-3">
                  <dt className="shrink-0 text-[var(--ink-faint)]">
                    <Clock aria-hidden="true" className="size-4" />
                    <span className="sr-only">Duration</span>
                  </dt>
                  <dd className="text-[var(--ink)]">{duration}</dd>
                </div>
              ) : null}
            </dl>

            {lecture.topics.length > 0 ? (
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <h3 className="eyebrow mb-2 text-[var(--ink-faint)]">Topics</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {lecture.topics.map((topic) => (
                    <li key={topic}>
                      <Badge>{topic}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 border-t border-[var(--border)] pt-4 text-xs text-[var(--ink-faint)]">
              <p>
                Published by{' '}
                <ExternalLink
                  href={lecture.sourceUrl}
                  publisher={lecture.sourceName}
                  className="underline hover:text-[var(--ink-muted)]"
                >
                  {lecture.sourceName}
                </ExternalLink>
                .
              </p>
              <p className="mt-1">
                Retrieved {formatDate(lecture.retrievedAt)} at {formatTime(lecture.retrievedAt)} PT.
              </p>
              {source ? <p className="mt-2">{source.restrictions}</p> : null}
            </div>
          </div>
        </aside>
      </article>

      {related.length > 0 ? (
        <section aria-labelledby="related" className="mt-16 border-t border-[var(--border)] pt-10">
          <h2 id="related" className="font-display mb-6 text-2xl">
            Related talks
          </h2>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((entry) => (
              <li key={entry.id} className="min-w-0">
                <LectureCard lecture={entry} href={`/lectures/${lectureSlug(entry)}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
