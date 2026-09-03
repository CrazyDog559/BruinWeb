import { Clock, MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { SmartImage } from '@/components/ui/SmartImage';
import { SourceChip, accentVars } from '@/components/media/SourceChip';
import { getSource } from '@/lib/config/sources';
import { formatDate, formatDuration, formatRelative, formatTime } from '@/lib/normalize';
import type { MediaItem } from '@/lib/types';

type CardVariant = 'lead' | 'standard' | 'compact';

interface MediaCardProps {
  item: MediaItem;
  variant?: CardVariant;
  /** Only the first card above the fold should opt out of lazy loading. */
  priority?: boolean;
}

/** Placeholder rows must be unmistakable at a glance. */
function DataModeBadge({ item }: { item: MediaItem }) {
  if (item.dataMode === 'placeholder') return <Badge tone="warn">Placeholder</Badge>;
  return null;
}

function Meta({ item }: { item: MediaItem }) {
  const isEvent = item.kind === 'event' && item.startsAt;
  const duration = formatDuration(item.durationSeconds);

  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-3 text-xs text-[var(--ink-faint)]">
      {isEvent ? (
        <time dateTime={item.startsAt ?? undefined} className="font-medium text-[var(--ink-muted)]">
          {formatDate(item.startsAt)} · {formatTime(item.startsAt)}
        </time>
      ) : item.publishedAt ? (
        /*
         * Relative times are computed at build time for statically rendered
         * pages and again at hydration for client-rendered ones, so "3h ago"
         * legitimately becomes "4h ago" in between. `suppressHydrationWarning`
         * is React's sanctioned escape hatch for exactly this: the machine-
         * readable `dateTime` and the `title` tooltip both stay exact.
         */
        <time
          dateTime={item.publishedAt}
          title={formatDate(item.publishedAt)}
          suppressHydrationWarning
        >
          {formatRelative(item.publishedAt)}
        </time>
      ) : null}

      {item.authors.length > 0 ? <span className="truncate">{item.authors.join(', ')}</span> : null}

      {duration ? (
        <span className="inline-flex items-center gap-1">
          <Clock aria-hidden="true" className="size-3" />
          {duration}
        </span>
      ) : null}

      {item.location ? (
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{item.location}</span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * The single story card used everywhere.
 *
 * The whole card is clickable via a stretched overlay on the title link, so
 * there is exactly one tab stop and one accessible name per card — no
 * duplicate "read more" links for a screen reader to wade through.
 */
export function MediaCard({ item, variant = 'standard', priority = false }: MediaCardProps) {
  const source = getSource(item.sourceId);
  const isLead = variant === 'lead';
  const isCompact = variant === 'compact';

  const titleClasses = isLead
    ? 'font-display text-2xl leading-[1.15] sm:text-3xl'
    : isCompact
      ? 'text-[0.95rem] leading-snug font-semibold'
      : 'font-display text-lg leading-snug sm:text-xl';

  return (
    <article
      className="group surface relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] transition-shadow duration-200 focus-within:shadow-lg hover:shadow-lg"
      style={source ? accentVars(source) : undefined}
    >
      {!isCompact && (item.image || isLead) ? (
        <SmartImage
          src={item.image?.src ?? null}
          srcSet={item.image?.srcSet}
          alt={item.image?.alt ?? ''}
          seed={item.id}
          priority={priority}
          aspect={isLead ? '16 / 9' : '3 / 2'}
          sizes={
            isLead
              ? '(min-width: 1024px) 50vw, 100vw'
              : '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw'
          }
          className="w-full"
        />
      ) : null}

      <div className={`flex flex-1 flex-col ${isLead ? 'p-5 sm:p-6' : 'p-4'}`}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SourceChip sourceId={item.sourceId} />
          <DataModeBadge item={item} />
          {item.badges.slice(0, 2).map((badge) => (
            <Badge key={badge} tone={badge === 'Final' ? 'accent' : 'neutral'}>
              {badge}
            </Badge>
          ))}
        </div>

        <h3 className={titleClasses}>
          <ExternalLink
            href={item.url}
            publisher={source?.name}
            showIcon={false}
            className="after:absolute after:inset-0 after:content-[''] hover:underline hover:decoration-[var(--accent)] hover:underline-offset-2"
          >
            {item.title}
          </ExternalLink>
        </h3>

        {item.excerpt && !isCompact ? (
          <p className={`mt-2 text-sm text-[var(--ink-muted)] ${isLead ? 'clamp-3' : 'clamp-2'}`}>
            {item.excerpt}
          </p>
        ) : null}

        <Meta item={item} />
      </div>
    </article>
  );
}
