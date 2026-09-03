import Link from 'next/link';
import { Headphones, Video } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { SmartImage } from '@/components/ui/SmartImage';
import { formatDate, formatDuration } from '@/lib/normalize';
import { LECTURE_FORMAT_LABELS, type Lecture } from '@/lib/types/lecture';

/**
 * A single public lecture.
 *
 * The card always names the format its publisher gives it — a research podcast
 * is never presented as a course lecture — and links to BruinWeb's own detail
 * page, which in turn links out to the publisher.
 */
export function LectureCard({
  lecture,
  href,
  priority = false,
}: {
  lecture: Lecture;
  href: string;
  priority?: boolean;
}) {
  const duration = formatDuration(lecture.durationSeconds);
  const MediaIcon = lecture.mediaType === 'video' ? Video : Headphones;

  return (
    <article className="group surface relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] transition-shadow focus-within:shadow-lg hover:shadow-lg">
      <div className="relative">
        <SmartImage
          src={lecture.thumbnailUrl}
          alt=""
          seed={lecture.id}
          aspect="16 / 9"
          priority={priority}
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="w-full"
        />
        {duration ? (
          <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">
            {duration}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="accent">
            <MediaIcon aria-hidden="true" className="size-3" />
            {LECTURE_FORMAT_LABELS[lecture.format]}
          </Badge>
          {lecture.series ? <Badge>{lecture.series}</Badge> : null}
        </div>

        <h3 className="font-display text-lg leading-snug">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] hover:underline"
          >
            {lecture.title}
          </Link>
        </h3>

        {lecture.speaker ? (
          <p className="mt-1.5 text-sm font-medium text-[var(--ink-muted)]">{lecture.speaker}</p>
        ) : null}

        {lecture.description ? (
          <p className="clamp-2 mt-1.5 text-sm text-[var(--ink-muted)]">{lecture.description}</p>
        ) : null}

        <p className="mt-auto pt-3 text-xs text-[var(--ink-faint)]">
          {lecture.department}
          {lecture.publishedAt ? (
            <>
              {' · '}
              <time dateTime={lecture.publishedAt}>{formatDate(lecture.publishedAt)}</time>
            </>
          ) : null}
        </p>
      </div>
    </article>
  );
}
