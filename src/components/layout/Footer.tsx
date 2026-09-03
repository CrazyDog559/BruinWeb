import Link from 'next/link';

import { ExternalLink } from '@/components/ui/ExternalLink';
import { SITE } from '@/lib/config/site';
import { SOURCE_LIST } from '@/lib/config/sources';
import { formatDate, formatTime } from '@/lib/normalize';

export function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <footer className="mt-20 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_2fr]">
          <div>
            <p className="font-display text-xl font-semibold">
              <span className="text-[var(--accent)]">Bruin</span>Web
            </p>
            <p className="mt-3 max-w-sm text-sm text-[var(--ink-muted)]">
              {SITE.affiliationNotice}
            </p>
            <p className="mt-4 text-xs text-[var(--ink-faint)]">
              Content snapshot built {formatDate(generatedAt)} at {formatTime(generatedAt)} PT.
            </p>
          </div>

          <div>
            <h2 className="eyebrow text-[var(--ink-faint)]">Sources &amp; attribution</h2>
            <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {SOURCE_LIST.map((source) => (
                <li key={source.id} className="text-sm">
                  <ExternalLink
                    href={source.homepage}
                    publisher={source.name}
                    className="text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline"
                  >
                    {source.name}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--border)] pt-6 text-xs text-[var(--ink-faint)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Headlines, excerpts and metadata are shown under each publisher&rsquo;s own copyright.
            Full articles stay on the original sites.
          </p>
          <nav aria-label="Site information">
            <Link href="/about" className="font-medium hover:text-[var(--ink)] hover:underline">
              About &amp; data sources
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
