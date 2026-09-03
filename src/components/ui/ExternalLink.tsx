import { ArrowUpRight } from 'lucide-react';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Screen-reader suffix clarifying where the link goes. */
  publisher?: string;
  showIcon?: boolean;
}

/**
 * Every link that leaves BruinWeb goes through here, so the outbound indicator,
 * `rel` hardening and screen-reader announcement are impossible to forget.
 */
export function ExternalLink({
  href,
  children,
  className,
  publisher,
  showIcon = true,
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-external="true"
    >
      {children}
      {showIcon ? (
        <ArrowUpRight aria-hidden="true" className="ml-0.5 inline-block size-[0.9em] shrink-0" />
      ) : null}
      <span className="sr-only">
        {publisher ? ` (opens ${publisher} in a new tab)` : ' (opens in a new tab)'}
      </span>
    </a>
  );
}
