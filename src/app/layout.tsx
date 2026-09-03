import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SITE } from '@/lib/config/site';
import { getSnapshot } from '@/lib/data/load';

import './globals.css';

// Self-hosted at build time by next/font — no render-blocking third-party request.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['SOFT', 'WONK'],
});

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  robots: { index: true, follow: true },
};

/**
 * Applied before first paint so the correct theme is already in place and the
 * page never flashes the wrong background.
 */
const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('bruinweb-theme');var d=c==='dark'||((c===null||c==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { generatedAt } = await getSnapshot();

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">
        {/*
         * Runs synchronously as the first thing in the body, before the rest of
         * the page is parsed or painted, so the correct theme is already on
         * <html> at first paint. It deliberately does not live in a manual
         * <head>: React 19 hoists <script> elements, and a hand-written <head>
         * in the App Router conflicts with the one React generates.
         */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--accent-ink)]"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer generatedAt={generatedAt} />
      </body>
    </html>
  );
}
