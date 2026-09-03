'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu, Search, X } from 'lucide-react';

import { ThemeToggle } from '@/components/ThemeToggle';
import { NAV_SOURCES } from '@/lib/config/sources';
import { SITE } from '@/lib/config/site';

const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/today', label: 'Today' },
  { href: '/browse', label: 'Browse' },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [drawerPath, setDrawerPath] = useState(pathname);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close the mobile drawer on navigation. Done during render rather than in an
  // effect so the drawer never paints open on the page you just moved to.
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-display flex shrink-0 items-baseline gap-0.5 text-xl font-semibold tracking-tight"
        >
          <span className="text-[var(--accent)]">Bruin</span>
          <span>Web</span>
          <span aria-hidden="true" className="bg-gold-500 ml-0.5 h-2 w-2 rounded-full" />
          <span className="sr-only">{SITE.tagline}</span>
        </Link>

        <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 md:flex">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            <Search aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Search</span>
          </Link>

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="source-drawer"
            className="rounded-md p-2 text-[var(--ink-muted)] hover:text-[var(--ink)] md:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>

      {/* Desktop: the channel rail. */}
      <nav
        aria-label="Sources"
        className="hidden border-t border-[var(--border)] bg-[var(--bg-subtle)] md:block"
      >
        <ul className="rail mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {NAV_SOURCES.map((source) => {
            const href = `/source/${source.slug}`;
            const active = pathname === href;
            return (
              <li key={source.id}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'border-[var(--accent)] text-[var(--ink)]'
                      : 'border-transparent text-[var(--ink-faint)] hover:text-[var(--ink)]'
                  }`}
                >
                  <source.Icon aria-hidden="true" className="size-3.5" />
                  {source.shortName}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile drawer. */}
      {open ? (
        <div
          id="source-drawer"
          className="border-t border-[var(--border)] bg-[var(--bg)] md:hidden"
        >
          <nav aria-label="All sections" className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <ul className="grid gap-1">
              {PRIMARY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-[var(--bg-subtle)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="eyebrow mt-4 mb-1 px-3 text-[var(--ink-faint)]">Sources</p>
            <ul className="grid gap-1">
              {NAV_SOURCES.map((source) => (
                <li key={source.id}>
                  <Link
                    href={`/source/${source.slug}`}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm hover:bg-[var(--bg-subtle)]"
                  >
                    <source.Icon aria-hidden="true" className="size-4 text-[var(--ink-faint)]" />
                    {source.name}
                  </Link>
                </li>
              ))}
            </ul>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              Close menu
            </button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
