import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ArticleSchema,
  PaginatedSchema,
  normalizeArticle,
} from '@/lib/adapters/athletics-normalize';
import { parseMenuPage } from '@/lib/adapters/dining';
import { normalizeEpisode } from '@/lib/adapters/lectures/podcast';
import { getLectureSource } from '@/lib/config/lecture-sources';
import { parseFeed } from '@/lib/net/rss';
import {
  WpPostSchema,
  normalizeWpPost,
  type WordPressAdapterOptions,
} from '@/lib/adapters/wordpress-normalize';
import { MediaItemSchema } from '@/lib/data/schemas';

/**
 * Adapter tests against real captured responses.
 *
 * The fixtures in `tests/fixtures/` are genuine, trimmed responses from each
 * publisher, saved on 2026-09-03. They exist so a schema change upstream shows
 * up as a failing test rather than as an empty section in production, and so
 * these tests never depend on the network.
 *
 * Every adapter's output is additionally checked against `MediaItemSchema`,
 * which is the same schema the artifact layer validates against — if an adapter
 * can produce something unpersistable, that is a bug worth catching here.
 */

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures');
const read = (name: string) => readFileSync(path.join(FIXTURES, name), 'utf8');

const WP_OPTIONS: WordPressAdapterOptions = {
  sourceId: 'daily-bruin',
  apiBase: 'https://wp.dailybruin.com',
  kind: 'article',
  attribution: 'Daily Bruin',
  perPage: 24,
};

describe('WordPress adapter against a captured Daily Bruin response', () => {
  const raw = JSON.parse(read('wordpress-posts.json')) as unknown[];

  it('parses every captured post', () => {
    for (const entry of raw) {
      expect(WpPostSchema.safeParse(entry).success).toBe(true);
    }
  });

  it('normalizes into valid, persistable media items', () => {
    const items = raw
      .map((entry) => WpPostSchema.parse(entry))
      .map((post) => normalizeWpPost(post, WP_OPTIONS))
      .filter((item) => item !== null);

    expect(items.length).toBe(raw.length);

    for (const item of items) {
      expect(MediaItemSchema.safeParse(item).success, item!.title).toBe(true);
      expect(item!.sourceId).toBe('daily-bruin');
      expect(item!.url).toMatch(/^https:\/\//);
      expect(item!.title.length).toBeGreaterThan(0);
      // Retrieval time is not an item property; publication time is.
      expect(item!.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // No raw HTML may survive normalization.
      expect(item!.excerpt ?? '').not.toContain('<');
    }
  });

  it('produces stable ids across repeated runs', () => {
    const once = raw.map((e) => normalizeWpPost(WpPostSchema.parse(e), WP_OPTIONS)?.id);
    const twice = raw.map((e) => normalizeWpPost(WpPostSchema.parse(e), WP_OPTIONS)?.id);
    expect(once).toEqual(twice);
    expect(new Set(once).size).toBe(once.length);
  });
});

describe('Athletics adapter against a captured response', () => {
  const payload = JSON.parse(read('athletics-articles.json'));

  it('parses the pagination envelope the API actually returns', () => {
    const parsed = PaginatedSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.data.length).toBeGreaterThan(0);
  });

  it('normalizes into valid, persistable media items', () => {
    const rows = PaginatedSchema.parse(payload).data;
    const items = rows
      .map((row) => ArticleSchema.safeParse(row))
      .filter((parsed) => parsed.success)
      .map((parsed) => normalizeArticle(parsed.data, 'UCLA Athletics'))
      .filter((item) => item !== null);

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(MediaItemSchema.safeParse(item).success, item!.title).toBe(true);
      expect(item!.url).toMatch(/^https:\/\/uclabruins\.com\//);
    }
  });
});

describe('RSS adapters against captured feeds', () => {
  it('parses the UCLA Esports club-sports feed', () => {
    const items = parseFeed(read('esports-feed.xml'));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.link).toMatch(/^https?:\/\//);
    }
  });

  it('parses a captured UCLA podcast feed into lectures', () => {
    const source = getLectureSource('pourdavoud')!;
    const xml = read('podcast-feed.xml');
    const items = parseFeed(xml);
    expect(items.length).toBeGreaterThan(0);

    // The lecture adapter reads the raw XML shape rather than RssItem, so this
    // asserts the feed still carries the fields it depends on.
    expect(xml).toContain('<itunes:duration>');
    expect(xml).toContain('<pubDate>');

    const lecture = normalizeEpisode(
      {
        title: items[0].title,
        link: items[0].link,
        guid: items[0].guid,
        pubDate: items[0].pubDate,
        'itunes:duration': '3632',
        'itunes:summary': items[0].description,
      },
      source,
      null,
      '2026-09-03T00:00:00.000Z',
    );

    expect(lecture).not.toBeNull();
    expect(lecture!.durationSeconds).toBe(3632);
    expect(lecture!.department).toBe(source.department);
  });
});

describe('Dining adapter against a captured menu page', () => {
  const html = read('dining-menus.html');
  const menus = parseMenuPage(html);

  it('finds dining halls and their stations', () => {
    expect(menus.size).toBeGreaterThan(0);
  });

  it('classifies every dish into a known category', () => {
    let total = 0;
    let mains = 0;

    for (const sections of menus.values()) {
      for (const section of sections) {
        for (const item of section.items) {
          total += 1;
          if (item.isMainCourse) mains += 1;
          expect(item.name.length).toBeGreaterThan(0);
          expect(typeof item.isMainCourse).toBe('boolean');
          expect(item.classifiedBy).toBeTruthy();
        }
      }
    }

    expect(total).toBeGreaterThan(0);
    // Some dishes are promoted, but never all of them — a page where everything
    // is a main course means the classifier has stopped discriminating.
    expect(mains).toBeLessThan(total);
  });

  it('keeps the dietary labels UCLA published', () => {
    const tagged = [...menus.values()]
      .flatMap((sections) => sections.flatMap((section) => section.items))
      .filter((item) => item.tags.length > 0);

    expect(tagged.length).toBeGreaterThan(0);
    for (const item of tagged) {
      for (const tag of item.tags) expect(tag.length).toBeGreaterThan(0);
    }
  });
});

describe('adapters survive malformed and empty responses', () => {
  it('WordPress rejects malformed posts without throwing', () => {
    for (const bad of [{}, { id: 'x' }, null, [], 'string', { id: 1 }]) {
      expect(() => WpPostSchema.safeParse(bad)).not.toThrow();
      expect(WpPostSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('Athletics drops rows it cannot read', () => {
    for (const bad of [{}, { title: '' }, { permalink: 'x' }, null]) {
      const parsed = ArticleSchema.safeParse(bad);
      if (parsed.success) {
        expect(normalizeArticle(parsed.data, 'UCLA Athletics')).toBeNull();
      } else {
        expect(parsed.success).toBe(false);
      }
    }
  });

  it('RSS returns nothing rather than throwing on junk', () => {
    for (const bad of ['', '<rss></rss>', 'not xml at all', '<rss><channel></channel></rss>']) {
      expect(() => parseFeed(bad)).not.toThrow();
      expect(parseFeed(bad)).toEqual([]);
    }
  });

  it('Dining returns an empty map rather than throwing on junk', () => {
    for (const bad of ['', '<html></html>', '<div class="at-a-glance-menu"></div>']) {
      expect(() => parseMenuPage(bad)).not.toThrow();
      expect(parseMenuPage(bad).size).toBe(0);
    }
  });
});
