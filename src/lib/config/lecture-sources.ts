/**
 * Verified public UCLA lecture sources.
 *
 * Every entry here was checked by hand before being added. `affiliation` records
 * the evidence that the source is genuinely UCLA-run — a `ucla.edu` link inside
 * the feed itself, or a `ucla.edu` page that links to it. A source whose only
 * claim to UCLA is the word "UCLA" in its title does not belong in this file.
 *
 * Everything listed is public and unauthenticated. Nothing here requires a
 * login, an enrolment, or a paywall, and no entry works around an access
 * control. Sources whose robots.txt or terms discourage automated access are
 * recorded in `EXCLUDED_LECTURE_SOURCES` below rather than quietly used.
 *
 * We store metadata and links only. Audio and video stay on the publisher's own
 * infrastructure and are never copied, rehosted or re-encoded.
 */

import type { LectureFormat, LectureMediaType } from '@/lib/types/lecture';

/**
 * Retrieval strategies. Only `podcast-rss` is in use; the others are named so a
 * future source declares its adapter explicitly rather than by convention.
 */
export type LectureAdapterKind = 'podcast-rss' | 'archive-org';

export interface LectureSourceConfig {
  id: string;
  /** Display name of the publisher. */
  name: string;
  /** UCLA unit responsible — used as the lecture's `department`. */
  department: string;
  /** The series name, when the whole feed is one series. */
  series: string | null;
  /** Public homepage a reader can visit. */
  homepage: string;
  /** The exact machine-readable endpoint we retrieve. */
  endpoint: string;
  adapter: LectureAdapterKind;
  /**
   * What this source actually publishes. Set from what the publisher says, so
   * a research conversation is labelled a podcast and not a course lecture.
   */
  format: LectureFormat;
  mediaType: LectureMediaType;
  /** Evidence of genuine UCLA affiliation, quoted or cited. */
  affiliation: string;
  /** How the source was found. */
  discoveredBy: string;
  updateFrequency: string;
  /** Anything a reader or maintainer should know about reuse. */
  restrictions: string;
  /**
   * True only where the publisher officially supports third-party embedding.
   * Everything else is linked, never reframed.
   */
  embedAllowed: boolean;
  /** Cap on items taken per build, keeping the payload small. */
  limit: number;
  enabled: boolean;
}

export const LECTURE_SOURCES: LectureSourceConfig[] = [
  {
    id: 'pourdavoud',
    name: 'Legacies of Ancient Persia',
    department: 'UCLA Pourdavoud Institute for the Study of the Iranian World',
    series: 'Legacies of Ancient Persia',
    homepage: 'https://pourdavoud.ucla.edu/legacies-of-ancient-persia/',
    endpoint: 'https://feeds.resonaterecordings.com/legacies-of-ancient-persia',
    adapter: 'podcast-rss',
    format: 'lecture',
    mediaType: 'audio',
    affiliation:
      "The feed's channel link and every episode link resolve to pourdavoud.ucla.edu, the institute's own UCLA domain; the institute is listed among UCLA College podcasts.",
    discoveredBy: 'Public podcast feed linked from the institute’s UCLA page',
    updateFrequency: 'Roughly monthly',
    restrictions:
      'Metadata and links only. Episodes are hosted by the publisher and are linked, not rehosted.',
    embedAllowed: false,
    limit: 40,
    enabled: true,
  },
  {
    id: 'luskin-history-policy',
    name: 'The History-Politics Podcast',
    department: 'UCLA Luskin Center for History and Policy',
    series: 'The History-Politics Podcast',
    homepage: 'https://luskincenter.history.ucla.edu/',
    endpoint: 'https://rss.buzzsprout.com/952522.rss',
    adapter: 'podcast-rss',
    format: 'podcast',
    mediaType: 'audio',
    affiliation:
      "The feed's channel link is luskincenter.history.ucla.edu, the centre's UCLA domain.",
    discoveredBy: 'Public podcast feed linked from the centre’s UCLA page',
    updateFrequency: 'Roughly biweekly',
    restrictions: 'Metadata and links only. Audio stays on the publisher’s host.',
    embedAllowed: false,
    limit: 40,
    enabled: true,
  },
  {
    id: 'lewis-housing-voice',
    name: 'UCLA Housing Voice',
    department: 'UCLA Lewis Center for Regional Policy Studies',
    series: 'UCLA Housing Voice',
    homepage: 'https://www.lewis.ucla.edu/programs/housing/ucla-housing-voice-podcast',
    endpoint: 'https://rss.buzzsprout.com/1745274.rss',
    adapter: 'podcast-rss',
    format: 'podcast',
    mediaType: 'audio',
    affiliation:
      "The feed's channel link is lewis.ucla.edu, the centre's UCLA domain, and the show is listed on the UCLA College podcast directory.",
    discoveredBy: 'Public podcast feed linked from the centre’s UCLA page',
    updateFrequency: 'Weekly',
    restrictions:
      'Metadata and links only. A research-conversation format, labelled as a podcast rather than a lecture.',
    embedAllowed: false,
    limit: 40,
    enabled: true,
  },
  {
    id: 'burkle-center',
    name: 'UCLA Burkle Center for International Relations',
    department: 'UCLA Burkle Center for International Relations',
    series: null,
    homepage: 'https://www.international.ucla.edu/burkle/multimedia/podcasts',
    endpoint: 'https://www.international.ucla.edu/sites/burkle/rss.aspx',
    adapter: 'podcast-rss',
    format: 'panel',
    mediaType: 'audio',
    affiliation:
      'The feed is served from international.ucla.edu, UCLA’s own International Institute domain.',
    discoveredBy: 'Podcast feed published on the centre’s UCLA International Institute site',
    updateFrequency: 'Several times a term',
    restrictions:
      'Metadata and links only. international.ucla.edu disallows crawling /media, so the audio files themselves are never fetched — readers are linked to the publisher’s own episode page.',
    embedAllowed: false,
    limit: 30,
    enabled: true,
  },
  {
    id: 'ucla-euro',
    name: 'UCLA Center for European and Russian Studies',
    department: 'UCLA Center for European and Russian Studies',
    series: null,
    homepage: 'https://www.international.ucla.edu/euro/',
    endpoint: 'https://www.international.ucla.edu/sites/euro/rss.aspx',
    adapter: 'podcast-rss',
    format: 'guest-talk',
    mediaType: 'audio',
    affiliation:
      'The feed is served from international.ucla.edu, UCLA’s own International Institute domain.',
    discoveredBy: 'Podcast feed published on the centre’s UCLA International Institute site',
    updateFrequency: 'Several times a term',
    restrictions:
      'Metadata and links only. The /media path on this host is robots-disallowed and is never fetched.',
    embedAllowed: false,
    limit: 30,
    enabled: true,
  },
  {
    id: 'ucla-lai',
    name: 'UCLA Latin American Institute',
    department: 'UCLA Latin American Institute',
    series: null,
    homepage: 'https://www.international.ucla.edu/lai/podcasts',
    endpoint: 'https://www.international.ucla.edu/sites/lai/rss.aspx',
    adapter: 'podcast-rss',
    format: 'panel',
    mediaType: 'audio',
    affiliation:
      'The feed is served from international.ucla.edu, UCLA’s own International Institute domain.',
    discoveredBy: 'Podcast feed published on the institute’s UCLA International Institute site',
    updateFrequency: 'Occasionally',
    restrictions:
      'Metadata and links only. The /media path on this host is robots-disallowed and is never fetched.',
    embedAllowed: false,
    limit: 30,
    enabled: true,
  },
];

/**
 * Sources investigated and deliberately NOT integrated. Recorded so the choice
 * is visible and so nobody re-adds them without re-checking.
 */
export const EXCLUDED_LECTURE_SOURCES: Array<{ name: string; url: string; reason: string }> = [
  {
    name: 'UCLA Anderson School of Management podcasts',
    url: 'https://www.anderson.ucla.edu/',
    reason:
      'Genuine faculty research talks, but anderson.ucla.edu/robots.txt disallows automated crawlers by name. We do not work around a publisher’s stated preference, so the source is excluded rather than used.',
  },
  {
    name: 'Official UCLA YouTube channels (IPAM, Burkle Center, UCLA Library, School of Law, DGSOM, International Institute)',
    url: 'https://www.youtube.com/robots.txt',
    reason:
      'These are genuine UCLA channels carrying real lecture recordings, and YouTube’s per-channel Atom feed would have been the natural retrieval surface. It is off limits: youtube.com/robots.txt contains "Disallow: /feeds/videos.xml" for every crawler except Google’s own, and the endpoint returned 404 to every request we made regardless. We do not work around a robots.txt directive, so YouTube is excluded. The official alternative is the YouTube Data API, which needs an API key — that would be a build-time secret and a new adapter, and is recorded in docs/INTEGRATIONS.md as the way to add these channels later.',
  },
  {
    name: 'UCLA BruinCast',
    url: 'https://bruincast.ucla.edu/',
    reason:
      'Course capture for enrolled students. It requires a UCLA login, so it is out of scope entirely — BruinWeb never touches authenticated or enrolment-gated material.',
  },
  {
    name: 'UCLA Internal Medicine Grand Rounds',
    url: 'https://feeds.feedburner.com/UclaInternalMedicine',
    reason:
      'The feed still resolves but has published nothing since 2013, and its channel link points off the ucla.edu domain, so affiliation could not be confirmed.',
  },
  {
    name: 'Re:Work (UCLA Labor Center)',
    url: 'https://reworkradio.labor.ucla.edu/',
    reason:
      'Verified UCLA affiliation, but the show is narrative documentary journalism rather than lectures or academic talks. Including it would mislabel the content.',
  },
  {
    name: 'UCLA Center for Chinese Studies, African Studies Center, Nazarian Center, Center for India and South Asia',
    url: 'https://www.international.ucla.edu/',
    reason:
      'Real UCLA feeds carrying genuine talks, but dormant — most recent items range from 2009 to 2024. Left out to keep the browser current; each is a one-line addition to LECTURE_SOURCES if dormant content becomes desirable.',
  },
];

export function getLectureSource(id: string): LectureSourceConfig | undefined {
  return LECTURE_SOURCES.find((source) => source.id === id);
}

export const ACTIVE_LECTURE_SOURCES = LECTURE_SOURCES.filter((source) => source.enabled);
