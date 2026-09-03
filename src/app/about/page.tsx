import { Container } from '@/components/layout/Section';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { Badge } from '@/components/ui/Badge';
import { SITE } from '@/lib/config/site';
import { RETRIEVAL_LABELS, SOURCE_LIST } from '@/lib/config/sources';
import { getSnapshot } from '@/lib/data/load';
import { formatDate, formatTime } from '@/lib/normalize';
import type { SourceStatus } from '@/lib/types';

export const metadata = {
  title: 'About & data sources',
  description:
    'How BruinWeb retrieves each source, what it can and cannot do, and who owns the content.',
};

const STATUS_LABELS: Record<SourceStatus, string> = {
  ok: 'Live at build',
  empty: 'No items',
  error: 'Unreachable',
  unavailable: 'Blocked',
  placeholder: 'Placeholder',
};

export default async function AboutPage() {
  const { results, generatedAt } = await getSnapshot();

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-10 max-w-3xl">
        <h1 className="font-display text-3xl sm:text-5xl">About BruinWeb</h1>
        <p className="mt-4 text-lg text-[var(--ink-muted)]">{SITE.affiliationNotice}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="how-it-works" className="max-w-3xl">
          <h2 id="how-it-works" className="font-display text-2xl">
            How it works
          </h2>
          <div className="mt-4 space-y-4 text-[var(--ink-muted)]">
            <p>
              BruinWeb is a static site. Every source is fetched once, during the build, by a
              server-side adapter; the result is baked into the HTML you are reading. There is no
              database, no API server and no tracking — search and filtering run in your browser
              against the content already on the page.
            </p>
            <p>
              Each channel is normalized into one shared shape, so a story from the Daily Bruin and
              a game from UCLA Athletics can sit in the same feed. When two sources carry the same
              story, it is shown once, credited to whoever published it first.
            </p>
            <p>
              We show headlines, short excerpts and metadata — never full articles. Every card links
              back to the publisher, and each section names its source and the time it was
              retrieved.
            </p>
          </div>
        </section>

        <aside className="surface h-fit rounded-[var(--radius-card)] p-5">
          <h2 className="eyebrow text-[var(--ink-faint)]">This build</h2>
          <p className="font-display mt-2 text-xl">
            {formatDate(generatedAt)}
            <span className="block text-sm font-normal text-[var(--ink-muted)]">
              {formatTime(generatedAt)} Pacific
            </span>
          </p>
          <p className="mt-4 text-sm text-[var(--ink-muted)]">
            Content is as fresh as the last deploy. Rebuilding refreshes every source.
          </p>
        </aside>
      </div>

      <section aria-labelledby="matrix" className="mt-14">
        <h2 id="matrix" className="font-display text-2xl">
          Data-source matrix
        </h2>
        <p className="mt-2 max-w-3xl text-[var(--ink-muted)]">
          Every source we investigated, the method we chose, and the limitation that comes with it.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Data sources, retrieval methods, status and known limitations
            </caption>
            <thead>
              <tr className="border-b border-[var(--border-strong)]">
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Source
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Method
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Status
                </th>
                <th scope="col" className="py-3 font-semibold">
                  Limitation
                </th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_LIST.map((source) => {
                const result = results[source.id];
                return (
                  <tr key={source.id} className="border-b border-[var(--border)] align-top">
                    <th scope="row" className="py-4 pr-4 font-medium">
                      <ExternalLink
                        href={source.homepage}
                        publisher={source.name}
                        className="hover:underline"
                      >
                        {source.name}
                      </ExternalLink>
                      <span className="mt-1 block text-xs font-normal text-[var(--ink-faint)]">
                        {source.attribution}
                      </span>
                    </th>
                    <td className="py-4 pr-4 text-[var(--ink-muted)]">
                      {RETRIEVAL_LABELS[source.retrieval]}
                      {source.endpoint ? (
                        <span className="mt-1 block font-mono text-[0.6875rem] break-all text-[var(--ink-faint)]">
                          {source.endpoint}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4">
                      <Badge tone={result?.status === 'ok' ? 'accent' : 'warn'}>
                        {STATUS_LABELS[result?.status ?? 'error']}
                      </Badge>
                    </td>
                    <td className="py-4 text-[var(--ink-muted)]">{source.integrationNote}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="branding" className="mt-14 max-w-3xl">
        <h2 id="branding" className="font-display text-2xl">
          Branding &amp; attribution
        </h2>
        <p className="mt-4 text-[var(--ink-muted)]">
          BruinWeb uses a text-only identity. No UCLA logo, wordmark or other protected asset is
          reproduced anywhere on this site; the blue and gold palette is inspired by the
          university&rsquo;s public colors. All headlines, excerpts, images and menus remain the
          property of their publishers and are shown here with a link back to the original.
        </p>
        <p className="mt-4 text-[var(--ink-muted)]">
          If you publish one of these sources and would like your content presented differently — or
          removed — please open an issue on the project repository.
        </p>
      </section>
    </Container>
  );
}
