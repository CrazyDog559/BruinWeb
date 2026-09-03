import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** Consistent page container width. */
export function Container({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** A titled band of content with an optional "see all" affordance. */
export function Section({
  title,
  description,
  href,
  linkLabel,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`py-10 sm:py-14 ${className}`}
      aria-labelledby={`section-${title.replace(/\W+/g, '-').toLowerCase()}`}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id={`section-${title.replace(/\W+/g, '-').toLowerCase()}`}
            className="font-display text-2xl sm:text-3xl"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">{description}</p>
          ) : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
          >
            {linkLabel ?? 'See all'}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
