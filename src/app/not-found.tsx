import Link from 'next/link';

import { Container } from '@/components/layout/Section';

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="eyebrow text-[var(--ink-faint)]">404</p>
      <h1 className="font-display mt-3 text-4xl">That page isn&rsquo;t here</h1>
      <p className="mx-auto mt-3 max-w-md text-[var(--ink-muted)]">
        The link may be out of date. Everything BruinWeb has loaded is searchable from Browse.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)]"
        >
          Back home
        </Link>
        <Link
          href="/browse"
          className="rounded-full border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold"
        >
          Browse everything
        </Link>
      </div>
    </Container>
  );
}
