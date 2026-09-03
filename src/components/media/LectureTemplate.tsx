import { Construction, Lock, Play, Unlock } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { SmartImage } from '@/components/ui/SmartImage';
import { SourceStatus } from '@/components/media/SourceStatus';
import type { SourceConfig } from '@/lib/config/sources';
import { formatDate, formatDuration } from '@/lib/normalize';
import type { MediaItem, SourceResult } from '@/lib/types';

/**
 * The reusable Lectures card template.
 *
 * It renders `MediaItem`s exactly as a real provider would produce them, so
 * wiring up Panopto later is a change of adapter, not of interface. Because the
 * rows are placeholders today, the whole section is banner-labelled and every
 * card carries a "Placeholder" badge — nothing here can be mistaken for real
 * UCLA lecture content.
 */
export function LectureTemplate({
  items,
  result,
  source,
  /** False when the page already explains the integration above the fold. */
  showNote = true,
}: {
  items: MediaItem[];
  result: SourceResult;
  source: SourceConfig;
  showNote?: boolean;
}) {
  if (items.length === 0) {
    return <SourceStatus source={source} result={result} showNote={showNote} />;
  }

  return (
    <div>
      <div
        role="note"
        className="mb-8 flex items-start gap-4 rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <Construction aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="font-display text-lg">Coming soon — interface template</h2>
          <p className="mt-1.5 text-sm">
            The cards below use placeholder data to show how recorded lectures will appear. They are
            not real UCLA recordings, and no lecture data is being retrieved.{' '}
            {source.integrationNote}
          </p>
        </div>
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <LectureCard item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LectureCard({ item }: { item: MediaItem }) {
  const restricted = item.badges.includes('UCLA sign-in required');
  const duration = formatDuration(item.durationSeconds);
  const [department, courseCode] = item.categories;

  return (
    <article className="surface flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] opacity-90">
      <div className="relative">
        <SmartImage
          src={item.image?.src ?? null}
          alt=""
          seed={item.id}
          aspect="16 / 9"
          className="w-full"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-black/25"
        >
          <Play className="size-10 text-white/80" />
        </span>
        {duration ? (
          <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
            {duration}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="warn">Placeholder</Badge>
          <Badge tone={restricted ? 'neutral' : 'accent'}>
            {restricted ? (
              <Lock aria-hidden="true" className="size-3" />
            ) : (
              <Unlock aria-hidden="true" className="size-3" />
            )}
            {restricted ? 'UCLA sign-in' : 'Open access'}
          </Badge>
        </div>

        <h3 className="font-display text-lg leading-snug">{item.title}</h3>

        <dl className="mt-2 space-y-0.5 text-sm text-[var(--ink-muted)]">
          {item.authors[0] ? (
            <div className="flex gap-1.5">
              <dt className="sr-only">Instructor</dt>
              <dd>{item.authors[0]}</dd>
            </div>
          ) : null}
          {department ? (
            <div className="flex gap-1.5">
              <dt className="sr-only">Department</dt>
              <dd>
                {department}
                {courseCode ? ` · ${courseCode}` : ''}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-auto pt-3 text-xs text-[var(--ink-faint)]">
          {item.publishedAt ? (
            <time dateTime={item.publishedAt}>Recorded {formatDate(item.publishedAt)}</time>
          ) : null}
        </p>
      </div>
    </article>
  );
}
