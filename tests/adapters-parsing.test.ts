import { describe, expect, it } from 'vitest';

import {
  parseHoursRange,
  parseHoursPage,
  parseMenuPage,
  buildDiningDay,
} from '@/lib/adapters/dining';
import { extractEventsPayload, normalizeEvent } from '@/lib/adapters/events';
import { parseFeed } from '@/lib/net/rss';
import { normalizeScheduleEvent } from '@/lib/adapters/athletics';

describe('dining parseHoursRange', () => {
  it('parses "7:00 a.m. -9:00 a.m."', () => {
    expect(parseHoursRange('7:00 a.m. -9:00 a.m.')).toEqual({ opens: '07:00', closes: '09:00' });
  });

  it('parses "11:00 a.m. - 2:00 p.m."', () => {
    expect(parseHoursRange('11:00 a.m. - 2:00 p.m.')).toEqual({ opens: '11:00', closes: '14:00' });
  });

  it('parses "5:00 p.m.- 8:00 p.m."', () => {
    expect(parseHoursRange('5:00 p.m.- 8:00 p.m.')).toEqual({ opens: '17:00', closes: '20:00' });
  });

  it('returns null for "Closed"', () => {
    expect(parseHoursRange('Closed')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseHoursRange('')).toBeNull();
  });
});

describe('dining parseHoursPage', () => {
  const html = `
    <table class="dining-hours-table">
      <thead>
        <tr><th>Location</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Extended Dinner</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><a href="/venues/de-neve/">De Neve Dining</a></td>
          <td>7:00 a.m. -9:00 a.m.</td>
          <td>11:00 a.m. - 2:00 p.m.</td>
          <td>5:00 p.m.- 8:00 p.m.</td>
          <td>Closed</td>
        </tr>
        <tr>
          <td><a href="/venues/bplate/">B-Plate</a></td>
          <td>Closed</td>
          <td>11:00 a.m. - 2:00 p.m.</td>
          <td>5:00 p.m.- 8:00 p.m.</td>
          <td>8:00 p.m.- 11:00 p.m.</td>
        </tr>
      </tbody>
    </table>
  `;

  it('parses each venue row into hours seeds', () => {
    const seeds = parseHoursPage(html);
    expect(seeds).toHaveLength(2);

    const deNeve = seeds.find((s) => s.name === 'De Neve Dining');
    expect(deNeve).toBeDefined();
    expect(deNeve!.id).toBe('de-neve-dining');
    expect(deNeve!.url).toBe('https://dining.ucla.edu/venues/de-neve/');
    expect(deNeve!.hours).toEqual([
      { period: 'breakfast', opens: '07:00', closes: '09:00' },
      { period: 'lunch', opens: '11:00', closes: '14:00' },
      { period: 'dinner', opens: '17:00', closes: '20:00' },
    ]);

    const bplate = seeds.find((s) => s.name === 'B-Plate');
    expect(bplate!.hours).toEqual([
      { period: 'lunch', opens: '11:00', closes: '14:00' },
      { period: 'dinner', opens: '17:00', closes: '20:00' },
      { period: 'late-night', opens: '20:00', closes: '23:00' },
    ]);
  });

  it('returns an empty array when the table is absent', () => {
    expect(parseHoursPage('<div>no table here</div>')).toEqual([]);
  });
});

describe('dining parseMenuPage', () => {
  const html = `
    <div class="at-a-glance-menu" id="lunchmenu">
      <div class="at-a-glance-menu__dining-location">
        <h3>De Neve Dining</h3>
        <div class="at-a-glance-menu__meal-station">
          <h4>The Front Burner</h4>
          <ul>
            <li><a href="/item/grilled-chicken">Grilled Chicken</a><img class="meal-station__allergen-icon" title="Contains Gluten" src="gluten.png"/></li>
            <li><a href="/item/veggie-bowl">Veggie Bowl</a><img class="meal-station__allergen-icon" title="Vegan" src="vegan.png"/></li>
          </ul>
        </div>
      </div>
    </div>
  `;

  it('parses venues, stations, items and allergen tags', () => {
    const byVenue = parseMenuPage(html);
    expect(byVenue.size).toBe(1);

    const sections = byVenue.get('De Neve Dining');
    expect(sections).toHaveLength(1);
    expect(sections![0].period).toBe('lunch');
    expect(sections![0].items).toHaveLength(2);

    const chicken = sections![0].items.find((i) => i.name === 'Grilled Chicken');
    expect(chicken).toMatchObject({
      station: 'The Front Burner',
      tags: ['Contains Gluten'],
      url: 'https://dining.ucla.edu/item/grilled-chicken',
    });
  });

  it('returns an empty map when there is no recognized section', () => {
    expect(parseMenuPage('<div>nothing here</div>').size).toBe(0);
  });
});

describe('dining buildDiningDay', () => {
  it('merges hours seeds with menus and marks a venue with no hours as not open', () => {
    const seeds = [
      {
        id: 'de-neve-dining',
        name: 'De Neve Dining',
        url: 'https://dining.ucla.edu/venues/de-neve/',
        hours: [{ period: 'lunch' as const, opens: '11:00', closes: '14:00' }],
      },
      {
        id: 'no-hours-venue',
        name: 'No Hours Venue',
        url: 'https://dining.ucla.edu/venues/none/',
        hours: [],
      },
    ];
    const menus = new Map([
      [
        'De Neve Dining',
        [
          {
            period: 'lunch' as const,
            items: [
              {
                id: 'x',
                name: 'Item',
                station: null,
                tags: [],
                url: null,
                category: 'other' as const,
                isMainCourse: false,
                classifiedBy: 'default' as const,
              },
            ],
          },
        ],
      ],
    ]);

    const day = buildDiningDay('2026-09-02', seeds, menus);
    expect(day.date).toBe('2026-09-02');

    const deNeve = day.venues.find((v) => v.id === 'de-neve-dining');
    expect(deNeve!.open).toBe(true);
    expect(deNeve!.menus).toHaveLength(1);

    const noHours = day.venues.find((v) => v.id === 'no-hours-venue');
    expect(noHours!.open).toBe(false);
  });

  it('includes venues present only in the menu map', () => {
    const menus = new Map([
      [
        'Menu-Only Venue',
        [
          {
            period: 'dinner' as const,
            items: [
              {
                id: 'y',
                name: 'Special',
                station: null,
                tags: [],
                url: null,
                category: 'other' as const,
                isMainCourse: false,
                classifiedBy: 'default' as const,
              },
            ],
          },
        ],
      ],
    ]);
    const day = buildDiningDay('2026-09-02', [], menus);
    const venue = day.venues.find((v) => v.name === 'Menu-Only Venue');
    expect(venue).toBeDefined();
    expect(venue!.open).toBe(true);
    expect(venue!.hours).toEqual([]);
  });
});

describe('events extractEventsPayload', () => {
  it('finds the eventsData array embedded in a script block', () => {
    const html = `<html><body><script>const eventsData = [{"title":"Talk"},{"title":"Show &quot;Live&quot;"}];</script></body></html>`;
    const payload = extractEventsPayload(html);
    expect(payload).toHaveLength(2);
    expect(payload[0]).toEqual({ title: 'Talk' });
  });

  it('throws a clear error when the payload is absent', () => {
    expect(() => extractEventsPayload('<html><body>no data here</body></html>')).toThrow(
      /eventsData payload not found/,
    );
  });
});

describe('events normalizeEvent', () => {
  const attribution = 'UCLA';
  const homepage = 'https://www.ucla.edu/events';

  it('decodes HTML entities in the title', () => {
    const item = normalizeEvent(
      { title: 'Jazz &amp; Blues Night', field_start_date: null },
      attribution,
      homepage,
    );
    expect(item!.title).toBe('Jazz & Blues Night');
  });

  it('falls back to the homepage when field_link is missing', () => {
    const item = normalizeEvent({ title: 'Untitled Event' }, attribution, homepage);
    expect(item!.url).toBe(homepage);
  });

  it('falls back to the homepage when field_link is not http(s)', () => {
    const item = normalizeEvent(
      { title: 'Event', field_link: 'javascript:alert(1)' },
      attribution,
      homepage,
    );
    expect(item!.url).toBe(homepage);
  });

  it('uses field_link when it is a valid http(s) URL', () => {
    const item = normalizeEvent(
      { title: 'Event', field_link: 'https://www.ucla.edu/events/some-event' },
      attribution,
      homepage,
    );
    expect(item!.url).toBe('https://www.ucla.edu/events/some-event');
  });

  it('makes a relative field_image absolute', () => {
    const item = normalizeEvent(
      { title: 'Event', field_image: '/sites/default/files/event.jpg' },
      attribution,
      homepage,
    );
    expect(item!.image?.src).toBe('https://www.ucla.edu/sites/default/files/event.jpg');
  });
});

describe('rss parseFeed', () => {
  it('extracts fields from an RSS 2.0 feed and picks up media:thumbnail', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <title>Feed</title>
          <item>
            <title>Story One</title>
            <link>https://example.com/story-one</link>
            <guid>guid-1</guid>
            <pubDate>Wed, 02 Sep 2026 12:00:00 GMT</pubDate>
            <description>A description</description>
            <category>News</category>
            <category>Local</category>
            <media:thumbnail url="https://example.com/thumb.jpg" />
          </item>
        </channel>
      </rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Story One',
      link: 'https://example.com/story-one',
      pubDate: 'Wed, 02 Sep 2026 12:00:00 GMT',
      description: 'A description',
      categories: ['News', 'Local'],
      imageUrl: 'https://example.com/thumb.jpg',
    });
  });

  it('picks up media:content when there is no media:thumbnail', () => {
    const xml = `<rss version="2.0"><channel><item>
      <title>Story Two</title>
      <link>https://example.com/story-two</link>
      <media:content url="https://example.com/content.jpg" />
    </item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items[0].imageUrl).toBe('https://example.com/content.jpg');
  });

  it('falls back to the first <img> in the description when no media tag is present', () => {
    const xml = `<rss version="2.0"><channel><item>
      <title>Story Three</title>
      <link>https://example.com/story-three</link>
      <description>&lt;p&gt;Text &lt;img src="https://example.com/inline.jpg" /&gt;&lt;/p&gt;</description>
    </item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items[0].imageUrl).toBe('https://example.com/inline.jpg');
  });

  it('handles an Atom feed with entry/link href', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Feed</title>
        <entry>
          <title>Atom Story</title>
          <link href="https://example.com/atom-story" />
          <id>atom-1</id>
          <updated>2026-09-02T12:00:00Z</updated>
          <summary>Atom summary</summary>
        </entry>
      </feed>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Atom Story',
      link: 'https://example.com/atom-story',
      pubDate: '2026-09-02T12:00:00Z',
      description: 'Atom summary',
    });
  });
});

describe('athletics normalizeScheduleEvent', () => {
  const attribution = 'UCLA Athletics';
  const homepage = 'https://uclabruins.com/';

  it('uses the box score URL and "Final" badge for a completed event with a box score', () => {
    const item = normalizeScheduleEvent(
      {
        id: 1,
        datetime: '2026-09-01T20:00:00Z',
        opponent_name: 'USC',
        venue_type: 'home',
        status: 'completed',
        has_box_score: true,
        box_score_url: 'https://uclabruins.com/box-score/1',
      },
      attribution,
      "Men's Basketball",
      homepage,
    );
    expect(item!.url).toBe('https://uclabruins.com/box-score/1');
    expect(item!.badges).toContain('Final');
  });

  it('uses the homepage fallback and "Home" badge for an upcoming home event', () => {
    const item = normalizeScheduleEvent(
      {
        id: 2,
        datetime: '2026-10-01T20:00:00Z',
        opponent_name: 'Stanford',
        venue_type: 'home',
        status: 'scheduled',
      },
      attribution,
      "Men's Basketball",
      homepage,
    );
    expect(item!.url).toBe(homepage);
    expect(item!.badges).toContain('Home');
    expect(item!.badges).not.toContain('Final');
  });

  it('returns null when datetime is missing', () => {
    const item = normalizeScheduleEvent({ id: 3 }, attribution, undefined, homepage);
    expect(item).toBeNull();
  });
});
