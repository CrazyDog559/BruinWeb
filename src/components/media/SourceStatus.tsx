import { AlertTriangle, CircleSlash, Construction, Inbox } from 'lucide-react';

import { ExternalLink } from '@/components/ui/ExternalLink';
import type { SourceConfig } from '@/lib/config/sources';
import { formatDate, formatTime } from '@/lib/normalize';
import type { SourceResult } from '@/lib/types';

/**
 * Explains, in plain language, why a section has no content — and always offers
 * the official site as the way forward. Never blames the reader.
 */
export function SourceStatus({
  source,
  result,
  /**
   * Source pages already print `integrationNote` in their "How this works"
   * panel, so they pass false to avoid saying the same paragraph twice.
   */
  showNote = true,
}: {
  source: SourceConfig;
  result: SourceResult;
  showNote?: boolean;
}) {
  const messages: Record<
    Exclude<SourceResult['status'], 'ok'>,
    { Icon: typeof Inbox; heading: string; body: string }
  > = {
    empty: {
      Icon: Inbox,
      heading: 'Nothing published yet',
      body: `${source.name} responded, but had no items to show when this site was last built.`,
    },
    error: {
      Icon: AlertTriangle,
      heading: 'Could not reach this source',
      body: `${source.name} did not respond during the last build. Everything else on BruinWeb still works.`,
    },
    unavailable: {
      Icon: CircleSlash,
      heading: 'Integration not available',
      body: showNote
        ? source.integrationNote
        : `There is no machine-readable source to pull from, so nothing is shown here rather than anything invented.`,
    },
    placeholder: {
      Icon: Construction,
      heading: 'Coming soon',
      body: showNote
        ? source.integrationNote
        : 'This section is an interface template. No live data is being retrieved yet.',
    },
  };

  if (result.status === 'ok') return null;
  const { Icon, heading, body } = messages[result.status];

  return (
    <div className="surface rounded-[var(--radius-card)] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 rounded-full bg-[var(--bg-subtle)] p-2 text-[var(--ink-muted)]">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg">{heading}</h2>
          <p className="mt-1.5 max-w-prose text-sm text-[var(--ink-muted)]">{body}</p>
          {result.error ? (
            <p className="mt-2 font-mono text-xs text-[var(--ink-faint)]">Detail: {result.error}</p>
          ) : null}
          <p className="mt-4">
            <ExternalLink
              href={source.homepage}
              publisher={source.name}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              Visit {source.name}
            </ExternalLink>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Attribution and freshness line shown under every source section. */
export function SourceFooterNote({
  source,
  result,
}: {
  source: SourceConfig;
  result: SourceResult;
}) {
  return (
    <p className="text-xs text-[var(--ink-faint)]">
      Content from{' '}
      <ExternalLink
        href={source.homepage}
        publisher={source.name}
        className="underline hover:text-[var(--ink-muted)]"
      >
        {source.attribution}
      </ExternalLink>
      . Retrieved {formatDate(result.fetchedAt)} at {formatTime(result.fetchedAt)} PT ·{' '}
      {source.updateFrequency}.
    </p>
  );
}
