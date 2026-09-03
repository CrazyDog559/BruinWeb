import { describe, expect, it } from 'vitest';

import { decodeEntities, stripHtml, toExcerpt, slugify } from '@/lib/normalize/text';
import { makeId } from '@/lib/normalize/id';

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('removes script and style blocks entirely', () => {
    const input = '<script>alert("bad")</script><style>.a{color:red}</style><p>Hi there</p>';
    expect(stripHtml(input)).toBe('Hi there');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(stripHtml('Hello   \n\n  world  ')).toBe('Hello world');
  });

  it('handles null and undefined', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('decodeEntities', () => {
  it('decodes named entities', () => {
    expect(decodeEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeEntities('&lt;div&gt;')).toBe('<div>');
  });

  it('decodes decimal numeric entities', () => {
    expect(decodeEntities('It&#8217;s')).toBe('It’s');
  });

  it('decodes hex numeric entities', () => {
    expect(decodeEntities('&#x2019;')).toBe('’');
  });

  it('leaves unknown named entities untouched', () => {
    expect(decodeEntities('&unknownentity;')).toBe('&unknownentity;');
  });
});

describe('toExcerpt', () => {
  it('returns null for empty input', () => {
    expect(toExcerpt(null)).toBeNull();
    expect(toExcerpt(undefined)).toBeNull();
    expect(toExcerpt('')).toBeNull();
    expect(toExcerpt('<p></p>')).toBeNull();
  });

  it('returns the full text unchanged when short', () => {
    expect(toExcerpt('A short sentence.')).toBe('A short sentence.');
  });

  it('truncates long text at a word boundary and appends an ellipsis', () => {
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`);
    const long = words.join(' ');
    const excerpt = toExcerpt(long);
    expect(excerpt).not.toBeNull();
    expect(excerpt!.endsWith('…')).toBe(true);
    // Truncated at a word boundary: no partial word before the ellipsis.
    expect(excerpt!.slice(0, -1)).not.toMatch(/\d $/);
    expect(long.startsWith(excerpt!.slice(0, -1))).toBe(true);
    expect(excerpt!.length).toBeLessThan(long.length);
  });
});

describe('slugify', () => {
  it('strips diacritics', () => {
    expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
  });

  it('replaces punctuation with hyphens', () => {
    expect(slugify("Hello, World! It's a test.")).toBe('hello-world-it-s-a-test');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('caps length at 80 characters', () => {
    const result = slugify('a'.repeat(200));
    expect(result.length).toBe(80);
  });
});

describe('makeId', () => {
  it('is deterministic for the same inputs', () => {
    const a = makeId('daily-bruin', 'my-great-story-slug');
    const b = makeId('daily-bruin', 'my-great-story-slug');
    expect(a).toBe(b);
  });

  it('prefixes the sourceId', () => {
    const id = makeId('daily-bruin', 'my-great-story-slug');
    expect(id.startsWith('daily-bruin:')).toBe(true);
  });

  it('produces different ids for different inputs', () => {
    const a = makeId('daily-bruin', 'story-one');
    const b = makeId('daily-bruin', 'story-two');
    expect(a).not.toBe(b);
  });

  it('falls back to a hash when the slug is too short', () => {
    const id = makeId('dining', '1');
    expect(id.startsWith('dining:')).toBe(true);
    // Hash fallback is a 16-char hex string.
    expect(id.slice('dining:'.length)).toMatch(/^[0-9a-f]{16}$/);
  });
});
