import { describe, expect, it } from 'vitest';

import {
  normalizeWpPost,
  WpPostSchema,
  type WpPost,
  type WordPressAdapterOptions,
} from '@/lib/adapters/wordpress';

const options: WordPressAdapterOptions = {
  sourceId: 'daily-bruin',
  apiBase: 'https://wp.dailybruin.com',
  kind: 'article',
  attribution: 'Daily Bruin',
  perPage: 5,
};

function basePost(overrides: Record<string, unknown> = {}): WpPost {
  return {
    id: 42,
    link: 'https://dailybruin.com/2026/09/02/some-story',
    date: '2026-09-02T10:00:00',
    date_gmt: '2026-09-02T17:00:00',
    slug: 'some-story',
    title: { rendered: 'Bruins &amp; Bears face off' },
    excerpt: { rendered: '<p>A short excerpt about the game.</p>' },
    content: { rendered: '<p>Full body text here.</p>' },
    ...overrides,
  } as WpPost;
}

describe('normalizeWpPost', () => {
  it('produces the expected MediaItem fields from a realistic post', () => {
    const post = basePost({
      _embedded: {
        'wp:featuredmedia': [
          {
            source_url: 'https://wp.dailybruin.com/image.jpg',
            alt_text: 'A photo',
            media_details: { width: 800, height: 600 },
          },
        ],
        'wp:term': [
          [
            { name: 'Sports', taxonomy: 'category' },
            { name: 'Uncategorized', taxonomy: 'category' },
          ],
        ],
        author: [{ name: 'Fallback Author' }],
      },
      coauthors: [{ display_name: 'Jane Reporter' }],
    });

    const item = normalizeWpPost(post, options);

    expect(item).not.toBeNull();
    expect(item!.id).toBe('daily-bruin:some-story');
    expect(item!.title).toBe('Bruins & Bears face off');
    expect(item!.url).toBe('https://dailybruin.com/2026/09/02/some-story');
    expect(item!.excerpt).toBe('A short excerpt about the game.');
    expect(item!.image).toEqual({
      src: 'https://wp.dailybruin.com/image.jpg',
      alt: 'A photo',
      width: 800,
      height: 600,
    });
    expect(item!.categories).toEqual(['Sports']);
    expect(item!.authors).toEqual(['Jane Reporter']);
  });

  it('falls back to embedded author when coauthors are absent', () => {
    const post = basePost({
      _embedded: {
        author: [{ name: 'Fallback Author' }],
      },
    });
    const item = normalizeWpPost(post, options);
    expect(item!.authors).toEqual(['Fallback Author']);
  });

  it('prefers featured_image_src over the embedded media', () => {
    const post = basePost({
      featured_image_src: 'https://wp.dailybruin.com/direct.jpg',
      _embedded: {
        'wp:featuredmedia': [{ source_url: 'https://wp.dailybruin.com/embedded.jpg' }],
      },
    });
    const item = normalizeWpPost(post, options);
    expect(item!.image?.src).toBe('https://wp.dailybruin.com/direct.jpg');
  });

  it('returns null when the title is empty', () => {
    const post = basePost({ title: { rendered: '' } });
    expect(normalizeWpPost(post, options)).toBeNull();
  });

  it('returns null when the title is missing entirely', () => {
    const post = basePost({ title: undefined });
    expect(normalizeWpPost(post, options)).toBeNull();
  });

  it('prefers date_gmt over date', () => {
    const post = basePost({
      date: '2026-09-02T03:00:00',
      date_gmt: '2026-09-02T17:00:00',
    });
    const item = normalizeWpPost(post, options);
    // date_gmt is already UTC, so it is used as-is.
    expect(item!.publishedAt).toBe('2026-09-02T17:00:00.000Z');
  });
});

describe('WpPostSchema', () => {
  it('rejects an object missing id', () => {
    const result = WpPostSchema.safeParse({ link: 'https://dailybruin.com/story' });
    expect(result.success).toBe(false);
  });

  it('rejects an object missing link', () => {
    const result = WpPostSchema.safeParse({ id: 1 });
    expect(result.success).toBe(false);
  });

  it('accepts an object carrying unknown extra plugin fields', () => {
    const result = WpPostSchema.safeParse({
      id: 1,
      link: 'https://dailybruin.com/story',
      some_random_plugin_field: { nested: true },
      yoast_head_json: { title: 'SEO title' },
    });
    expect(result.success).toBe(true);
  });
});
