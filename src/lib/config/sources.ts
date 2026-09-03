/**
 * Central source registry.
 *
 * Everything the UI needs to describe a channel lives here — name, blurb,
 * colors, icon, navigation order, attribution, and the verified upstream URLs.
 * Components read this; they never hard-code a source name, link or color.
 *
 * `retrieval` records how each integration actually gets its data, and
 * `integrationNote` records the honest limitation. Both are rendered in the UI
 * and mirrored in docs/INTEGRATIONS.md.
 */

import {
  BookOpen,
  CalendarDays,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Landmark,
  Newspaper,
  Radio,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

import type { DataMode, MediaKind } from '@/lib/types';

export const SOURCE_IDS = [
  'dining',
  'daily-bruin',
  'ucla-radio',
  'comm-board',
  'bruinlife',
  'science-journal',
  'esports',
  'athletics',
  'events',
  'lectures',
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

/** How an integration obtains its data. Displayed verbatim on the About page. */
export type RetrievalMethod =
  'json-api' | 'rss' | 'embedded-structured-data' | 'html-adapter' | 'placeholder' | 'blocked';

export const RETRIEVAL_LABELS: Record<RetrievalMethod, string> = {
  'json-api': 'Official JSON API',
  rss: 'Official RSS feed',
  'embedded-structured-data': 'Structured data embedded in the page',
  'html-adapter': 'Public-page adapter',
  placeholder: 'Placeholder template',
  blocked: 'No machine-readable source',
};

export interface SourceConfig {
  id: SourceId;
  /** Display name of the upstream publisher. */
  name: string;
  /** Short label for chips and filters. */
  shortName: string;
  blurb: string;
  /** Route segment under `/source`. */
  slug: string;
  /** Public homepage of the publisher — the "visit official site" target. */
  homepage: string;
  /** The exact machine-readable endpoint used, when one exists. */
  endpoint: string | null;
  retrieval: RetrievalMethod;
  /** Expected freshness, shown next to the fetch timestamp. */
  updateFrequency: string;
  attribution: string;
  /** Honest statement of what this integration cannot do. */
  integrationNote: string;
  /** Baseline data mode. An adapter may still downgrade to `unavailable`. */
  defaultDataMode: DataMode;
  /** Media kinds this source can emit; drives the type filter. */
  kinds: MediaKind[];
  Icon: LucideIcon;
  /** Accent colors, one per theme, so contrast holds in both. */
  accent: { light: string; dark: string };
  /** Show in the primary navigation. */
  inNav: boolean;
  /** Turn an integration off without deleting its adapter. */
  enabled: boolean;
}

export const SOURCES: Record<SourceId, SourceConfig> = {
  dining: {
    id: 'dining',
    name: 'UCLA Dining',
    shortName: 'Dining',
    blurb: 'Hours, meal periods and daily menus for the residential restaurants on the Hill.',
    slug: 'dining',
    homepage: 'https://dining.ucla.edu/',
    endpoint: 'https://dining.ucla.edu/menus-at-a-glance/?date=YYYY-MM-DD',
    retrieval: 'html-adapter',
    updateFrequency: 'Menus change daily; hours change by term',
    attribution: 'UCLA Dining',
    integrationNote:
      'UCLA Dining exposes no public API — its WordPress REST API returns 401 on every route — so this adapter parses the public hours and “menus at a glance” pages, which robots.txt permits. Markup changes upstream will break parsing; the section degrades to an unavailable state rather than showing stale menus.',
    defaultDataMode: 'build',
    kinds: ['menu'],
    Icon: UtensilsCrossed,
    accent: { light: '#9a5b00', dark: '#ffc72c' },
    inNav: true,
    enabled: true,
  },
  'daily-bruin': {
    id: 'daily-bruin',
    name: 'Daily Bruin',
    shortName: 'Daily Bruin',
    blurb: "UCLA's independent student newspaper — news, sports, arts and opinion.",
    slug: 'daily-bruin',
    homepage: 'https://dailybruin.com/',
    endpoint: 'https://wp.dailybruin.com/wp-json/wp/v2/posts',
    retrieval: 'json-api',
    updateFrequency: 'Several times daily during the term',
    attribution: 'Daily Bruin',
    integrationNote:
      'Headlines, excerpts and metadata only. Full article text is copyrighted and is never republished here — every card links back to dailybruin.com.',
    defaultDataMode: 'build',
    kinds: ['article'],
    Icon: Newspaper,
    accent: { light: '#005587', dark: '#8bb8e8' },
    inNav: true,
    enabled: true,
  },
  'ucla-radio': {
    id: 'ucla-radio',
    name: 'UCLA Radio',
    shortName: 'Radio',
    blurb: 'Student radio — music reviews, interviews, concert coverage and shows.',
    slug: 'ucla-radio',
    homepage: 'https://uclaradio.com/',
    endpoint: 'https://uclaradio.com/wp-json/wp/v2/posts',
    retrieval: 'json-api',
    updateFrequency: 'Weekly',
    attribution: 'UCLA Radio',
    integrationNote:
      'Editorial posts only. UCLA Radio publishes no machine-readable show schedule or live-stream URL — its schedule page is built with a page builder whose content is empty in the REST API — so programming times and a listen-live link are not available here. Use the official site to listen.',
    defaultDataMode: 'build',
    kinds: ['audio'],
    Icon: Radio,
    accent: { light: '#7a2f8f', dark: '#d9a6e8' },
    inNav: true,
    enabled: true,
  },
  'comm-board': {
    id: 'comm-board',
    name: 'UCLA Communications Board',
    shortName: 'Comm Board',
    blurb:
      'The student-majority board that oversees UCLA Student Media — governance, meetings and policy.',
    slug: 'communications-board',
    homepage: 'https://uclastudentmedia.com/communications-board/',
    endpoint: 'https://uclastudentmedia.com/wp-json/wp/v2/pages',
    retrieval: 'json-api',
    updateFrequency: 'Occasionally — governance documents update by term or year',
    attribution: 'UCLA Communications Board / UCLA Student Media',
    integrationNote:
      'Verified official name and source: the UCLA Communications Board publishes through uclastudentmedia.com, which has no news feed of its own. This section surfaces its governance pages — bylaws, meeting schedules, operations and mission — from the WordPress pages API; storefront and account pages are filtered out.',
    defaultDataMode: 'build',
    kinds: ['publication'],
    Icon: Landmark,
    accent: { light: '#0f6b5c', dark: '#6fd8c3' },
    inNav: true,
    enabled: true,
  },
  bruinlife: {
    id: 'bruinlife',
    name: 'BruinLife',
    shortName: 'BruinLife',
    blurb: "UCLA's online magazine and yearbook — campus life, culture and lifestyle.",
    slug: 'bruinlife',
    homepage: 'https://bruinlife.com/',
    endpoint: 'https://bruinlife.com/wp-json/wp/v2/posts',
    retrieval: 'json-api',
    updateFrequency: 'A few times a month',
    attribution: 'BruinLife / UCLA Student Media',
    integrationNote:
      'Headlines, excerpts and metadata only; full posts stay on bruinlife.com. The yearbook storefront is intentionally excluded.',
    defaultDataMode: 'build',
    kinds: ['article'],
    Icon: BookOpen,
    accent: { light: '#b5342b', dark: '#ff9c94' },
    inNav: true,
    enabled: true,
  },
  'science-journal': {
    id: 'science-journal',
    name: 'UCLA Undergraduate Science Journal',
    shortName: 'Science Journal',
    blurb: 'Peer-reviewed undergraduate STEM research, published annually.',
    slug: 'science-journal',
    homepage: 'https://usjucla.wixsite.com/usj-ucla',
    endpoint: null,
    retrieval: 'blocked',
    updateFrequency: 'Annual',
    attribution: 'UCLA Undergraduate Science Journal',
    integrationNote:
      'Blocked, not skipped. The journal is published on a client-rendered Wix site with no API, no feed and no JSON-LD; issues are whole-PDF downloads with no per-article index. It is not on eScholarship, and eScholarship’s OAI-PMH exposes no per-journal set in any case. Rather than invent issues and authors, this section reports the blocker and links to the journal. The adapter contract is complete — see docs/INTEGRATIONS.md.',
    defaultDataMode: 'unavailable',
    kinds: ['publication'],
    Icon: FlaskConical,
    accent: { light: '#1d5c93', dark: '#8bb8e8' },
    inNav: true,
    enabled: true,
  },
  esports: {
    id: 'esports',
    name: 'UCLA Esports',
    shortName: 'Esports',
    blurb: 'Competitive gaming at UCLA — announcements, events and team news.',
    slug: 'esports',
    homepage: 'https://uclaclubsports.com/sports/esports',
    endpoint: 'https://uclaclubsports.com/rss.aspx?path=es',
    retrieval: 'rss',
    updateFrequency: 'Every few months',
    attribution: 'UCLA Esports / UCLA Recreation Club Sports',
    integrationNote:
      'News only. UCLA Esports is registered as a club sport with no schedule or roster in the athletics system, so match schedules, results and live-stream status have no official machine-readable source. Official social accounts are linked instead.',
    defaultDataMode: 'build',
    kinds: ['article'],
    Icon: Gamepad2,
    accent: { light: '#6a3fc0', dark: '#c0a8ff' },
    inNav: true,
    enabled: true,
  },
  athletics: {
    id: 'athletics',
    name: 'UCLA Athletics',
    shortName: 'Athletics',
    blurb: 'Bruin sports — stories, upcoming events and results across every varsity team.',
    slug: 'athletics',
    homepage: 'https://uclabruins.com/',
    endpoint: 'https://api.uclabruins.com/website-api/articles',
    retrieval: 'json-api',
    updateFrequency: 'Multiple times daily in season',
    attribution: 'UCLA Athletics',
    integrationNote:
      'Uses uclabruins.com’s own public website API, which robots.txt allows but which carries no published terms — field names may change without notice, so parsing is defensive. The API exposes no article body, which suits us: only headlines, summaries and schedule metadata are shown. Final scores are not in the feed; every result links to the official box score.',
    defaultDataMode: 'build',
    kinds: ['article', 'event'],
    Icon: Trophy,
    accent: { light: '#0b5ea8', dark: '#8bb8e8' },
    inNav: true,
    enabled: true,
  },
  events: {
    id: 'events',
    name: 'UCLA Events',
    shortName: 'Events',
    blurb: 'Featured happenings across campus — exhibitions, talks, performances and more.',
    slug: 'events',
    homepage: 'https://www.ucla.edu/events',
    endpoint: 'https://www.ucla.edu/events',
    retrieval: 'embedded-structured-data',
    updateFrequency: 'Weekly, editorially curated',
    attribution: 'UCLA',
    integrationNote:
      'Reads the structured event payload embedded in ucla.edu/events. This is UCLA’s curated highlights list, not the full campus calendar — calendar.ucla.edu did not respond during research and appears to have been retired.',
    defaultDataMode: 'build',
    kinds: ['event'],
    Icon: CalendarDays,
    accent: { light: '#0f6b5c', dark: '#6fd8c3' },
    inNav: true,
    enabled: true,
  },
  lectures: {
    id: 'lectures',
    name: 'UCLA Lectures',
    shortName: 'Lectures',
    blurb:
      'Recorded lectures and talks. Interface template — the Panopto integration is not built.',
    slug: 'lectures',
    homepage: 'https://www.panopto.com/',
    endpoint: null,
    retrieval: 'placeholder',
    updateFrequency: 'Not yet integrated',
    attribution: 'Placeholder template — not real UCLA lecture content',
    integrationNote:
      'Coming soon. This is a reusable visual template rendering clearly-labelled placeholder rows. Panopto requires institution-issued OAuth credentials and returns viewer-scoped content, so there is nothing a public static site can fetch anonymously. The adapter contract is finished; only the provider is missing.',
    defaultDataMode: 'placeholder',
    kinds: ['lecture'],
    Icon: GraduationCap,
    accent: { light: '#8a4b00', dark: '#ffc72c' },
    inNav: true,
    enabled: true,
  },
};

/** Registry order — also the navigation order. */
export const SOURCE_LIST: SourceConfig[] = SOURCE_IDS.map((id) => SOURCES[id]);

export const NAV_SOURCES: SourceConfig[] = SOURCE_LIST.filter(
  (source) => source.inNav && source.enabled,
);

export function getSource(id: string): SourceConfig | undefined {
  return (SOURCES as Record<string, SourceConfig>)[id];
}

export function getSourceBySlug(slug: string): SourceConfig | undefined {
  return SOURCE_LIST.find((source) => source.slug === slug);
}

/** Display name for a source id, falling back to the raw id. */
export function sourceName(id: string): string {
  return getSource(id)?.name ?? id;
}

/** Official UCLA Esports accounts, read from the sport record on the club sports site. */
export const ESPORTS_SOCIALS = [
  { label: 'Instagram', handle: '@uclaesports', url: 'https://www.instagram.com/uclaesports/' },
  { label: 'X', handle: '@UCLAEsports', url: 'https://x.com/UCLAEsports' },
  { label: 'Facebook', handle: 'UCLAEsports', url: 'https://www.facebook.com/UCLAEsports/' },
] as const;
