import { AlertTriangle, CheckCircle2, CircleSlash, Clock, RefreshCw, XCircle } from 'lucide-react';

import { Container } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { REFRESH_STRATEGY_LABELS, formatAge } from '@/lib/config/refresh';
import { SOURCES } from '@/lib/config/sources';
import { getSnapshot } from '@/lib/data/load';
import {
  HEALTH_DESCRIPTIONS,
  HEALTH_LABELS,
  type SourceHealth,
  type SourceStatusEntry,
} from '@/lib/data/status';
import { formatDate, formatTime } from '@/lib/normalize';

export const metadata = {
  title: 'Source status',
  description:
    'Live health of every BruinWeb integration: what was retrieved, when, and what is currently unavailable.',
};

const HEALTH_TONE: Record<SourceHealth, 'accent' | 'gold' | 'warn' | 'neutral'> = {
  live: 'accent',
  stale: 'gold',
  fallback: 'gold',
  unavailable: 'warn',
  blocked: 'warn',
  placeholder: 'neutral',
  disabled: 'neutral',
};

function HealthIcon({ health }: { health: SourceHealth }) {
  const className = 'size-3';
  if (health === 'live') return <CheckCircle2 aria-hidden="true" className={className} />;
  if (health === 'stale' || health === 'fallback')
    return <Clock aria-hidden="true" className={className} />;
  if (health === 'unavailable') return <XCircle aria-hidden="true" className={className} />;
  return <CircleSlash aria-hidden="true" className={className} />;
}

function StatusRow({ entry }: { entry: SourceStatusEntry }) {
  const config = SOURCES[entry.id];

  return (
    <li className="surface rounded-[var(--radius-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg">
            <ExternalLink
              href={entry.officialUrl}
              publisher={entry.name}
              className="hover:underline"
            >
              {entry.name}
            </ExternalLink>
          </h3>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {HEALTH_DESCRIPTIONS[entry.health]}
          </p>
        </div>
        <Badge tone={HEALTH_TONE[entry.health]}>
          <HealthIcon health={entry.health} />
          {HEALTH_LABELS[entry.health]}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="eyebrow text-[var(--ink-faint)]">Items</dt>
          <dd className="text-[var(--ink)]">{entry.itemCount}</dd>
        </div>
        <div>
          <dt className="eyebrow text-[var(--ink-faint)]">Last updated</dt>
          <dd className="text-[var(--ink)]">
            {entry.lastSuccessfulUpdate ? (
              <>
                <time dateTime={entry.lastSuccessfulUpdate}>
                  {formatDate(entry.lastSuccessfulUpdate)} {formatTime(entry.lastSuccessfulUpdate)}{' '}
                  PT
                </time>
                <span className="block text-[var(--ink-faint)]" suppressHydrationWarning>
                  {formatAge(entry.dataAgeMinutes)} old
                </span>
              </>
            ) : (
              <span className="text-[var(--ink-faint)]">never</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-[var(--ink-faint)]">Refresh</dt>
          <dd className="text-[var(--ink)]">
            {REFRESH_STRATEGY_LABELS[entry.refreshStrategy]}
            {entry.expectedEveryMinutes > 0 ? (
              <span className="block text-[var(--ink-faint)]">
                expected every {formatAge(entry.expectedEveryMinutes)}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-[var(--ink-faint)]">Retrieval</dt>
          <dd className="text-[var(--ink)]">
            {entry.retrievalDurationMs === null ? '—' : `${entry.retrievalDurationMs} ms`}
            <span className="block text-[var(--ink-faint)]">
              {entry.requiresCredentials
                ? `needs ${entry.credentialEnvVars.length} credential${entry.credentialEnvVars.length === 1 ? '' : 's'}`
                : 'no credentials'}
            </span>
          </dd>
        </div>
      </dl>

      {entry.error ? (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--ink-muted)]">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {entry.error}
        </p>
      ) : null}

      {entry.note ? <p className="mt-3 text-sm text-[var(--ink-muted)]">{entry.note}</p> : null}

      <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--ink-faint)]">
        {config.refresh.rationale}
      </p>
    </li>
  );
}

export default async function StatusPage() {
  const { report } = await getSnapshot();
  const { summary } = report;

  const cards: Array<[string, number]> = [
    ['Live', summary.live],
    ['Older data', summary.fallback],
    ['Stale', summary.stale],
    ['Unavailable', summary.unavailable],
    ['Blocked', summary.blocked],
    ['Placeholder', summary.placeholder],
  ];

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow text-[var(--ink-faint)]">Integration status</p>
        <h1 className="font-display mt-2 text-3xl sm:text-5xl">Where every section stands</h1>
        <p className="mt-3 max-w-3xl text-[var(--ink-muted)]">
          Generated during the build that produced this page, from the same data the rest of the
          site renders. A section is only called live when it actually retrieved current content —
          older, cached and placeholder content all say so plainly.
        </p>
      </header>

      <section aria-labelledby="summary" className="mb-10">
        <h2 id="summary" className="sr-only">
          Summary
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map(([label, value]) => (
            <div key={label} className="surface rounded-[var(--radius-card)] p-4">
              <dt className="eyebrow text-[var(--ink-faint)]">{label}</dt>
              <dd className="font-display mt-1 text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          {summary.totalItems} items across {summary.total} sections. Build ran{' '}
          <time dateTime={report.generatedAt}>
            {formatDate(report.generatedAt)} at {formatTime(report.generatedAt)} PT
          </time>
          {report.commit ? ` from commit ${report.commit.slice(0, 7)}` : ''}.
        </p>
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources" className="font-display mb-5 text-2xl">
          Every source
        </h2>
        <ul className="space-y-4">
          {report.sources.map((entry) => (
            <StatusRow key={entry.id} entry={entry} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="mt-12 border-t border-[var(--border)] pt-8">
        <h2 id="how" className="font-display text-xl">
          How content stays current
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-semibold">
              <RefreshCw aria-hidden="true" className="size-4 text-[var(--ink-faint)]" />
              In your browser
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Five sources refresh themselves when you open the page — Daily Bruin, UCLA Radio,
              BruinLife, the Communications Board and Athletics. Their public APIs allow
              cross-origin reads and need no credential, so your browser fetches them directly. No
              deployment is involved, and it is how the Daily Bruin section carries content at all:
              that publisher refuses cloud datacenters, but not people.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">On a schedule</h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Dining, Esports, Events and the lecture feeds send no CORS headers, so a browser
              cannot read them and they can only be retrieved during a build. A GitHub Actions
              workflow pings a Vercel deploy hook on a timetable to keep those current without
              anyone pushing code.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">When a source is down</h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              The last dataset that retrieved successfully is kept and shown with its true age,
              labelled as older data. With nothing cached, the section says it is unavailable.
              Nothing is invented to fill a gap.
            </p>
          </div>
        </div>
      </section>

      <p className="mt-8 text-xs text-[var(--ink-faint)]">
        A machine-readable copy of this report is published at{' '}
        <a href="/status.json" className="underline hover:text-[var(--ink-muted)]">
          /status.json
        </a>
        . It contains no credentials, and error messages are redacted before publication.
      </p>
    </Container>
  );
}
