import { describe, expect, it } from 'vitest';

import { buildDiningDay, classifyMenuItem, parseMenuPage } from '@/lib/adapters/dining';
import {
  CATEGORY_DISPLAY_ORDER,
  MAIN_COURSE_KIND,
  MENU_CATEGORY_KINDS,
  labelKind,
} from '@/lib/config/dining-menu';

/**
 * The classifier is the guard that stops a bowl of syrup being offered as
 * dinner, so these tests are written as a contract: named classes of
 * accompaniment must never come back as a main course, whatever station the
 * dining hall happens to serve them at.
 */

const MAIN_STATIONS = [
  'Capri',
  'The Grill/Psistaris',
  'Alimenti',
  'Capri Pizza',
  'Exhibition Kitchen',
];

describe('classifyMenuItem — accompaniments are never promoted', () => {
  const cases: Array<[label: string, dishes: string[], expected: string]> = [
    [
      'desserts',
      [
        'Classic Chocolate Chip Cookie',
        'Red Velvet Cake',
        'Mini Vanilla Cupcake',
        'Chocolate Cream Mousse',
      ],
      'dessert',
    ],
    [
      'drinks',
      ['Fresh Brewed Coffee', 'Orange Juice', 'Iced Tea', 'Strawberry Smoothie'],
      'beverage',
    ],
    [
      'condiments',
      ['Roasted Tomato Salsa', 'Maple Syrup', 'Country Gravy', 'Ranch Dressing'],
      'condiment',
    ],
    ['fruit', ['Cantaloupe', 'Pineapple', 'Watermelon', 'Grapefruit'], 'fruit'],
    ['soups', ['Chicken Noodle Soup', 'Boston Clam Chowder', 'Garden Vegetable Soup'], 'soup'],
    [
      'salads',
      ['Greek Salad', 'Caesar Salad', 'California Pasta Salad', 'Salad Bar Selection'],
      'salad',
    ],
    [
      'breakfast sides',
      [
        'Oatmeal',
        'Cream of Wheat',
        'Breakfast Hash Brown',
        'Turkey Sausage Link',
        'Lowfat Greek Yogurt',
      ],
      'side',
    ],
    [
      'starch sides',
      ['Saffron Rice', 'Lyonnaise Potatoes w/ Lemon', 'Polenta', 'French Fries', 'Tater Tots'],
      'side',
    ],
    ['bakery', ['Plain Bagel', 'Whole Wheat Bagel', 'Biscuit'], 'bakery'],
  ];

  for (const [label, dishes, expected] of cases) {
    it(`never promotes ${label}, even at an entrée station`, () => {
      for (const station of MAIN_STATIONS) {
        for (const dish of dishes) {
          const result = classifyMenuItem(station, dish);
          expect(result.isMainCourse, `${dish} @ ${station}`).toBe(false);
          expect(result.category, `${dish} @ ${station}`).toBe(expected);
        }
      }
    });
  }

  it('never promotes anything served at a desserts, drinks or condiments station', () => {
    const stations = ['Dolce', 'CONDIMENTS', 'Beverages', 'Coffee Bar', 'Fruit', 'Yogurt Bar'];
    const dishes = ['Grilled Chicken Breast', 'Cheese Pizza', 'Spaghetti Bolognese'];
    for (const station of stations) {
      for (const dish of dishes) {
        expect(classifyMenuItem(station, dish).isMainCourse, `${dish} @ ${station}`).toBe(false);
      }
    }
  });
});

describe('classifyMenuItem — genuine entrées are promoted', () => {
  const entrees = [
    'Grilled Chicken Breast',
    'Bruin Cheese Burger',
    'Cheese Pizza',
    'Spaghetti Bolognese',
    'Salmon Florentine w/ Rotini',
    'Harissa Pork Ribs',
    'Moroccan Stew',
    'Impossible Burger',
    'Chicken Tenders',
    'Grilled Cheese Sandwich',
  ];

  it('promotes substantial dishes at an entrée station', () => {
    for (const dish of entrees) {
      const result = classifyMenuItem('Alimenti', dish);
      expect(result.isMainCourse, dish).toBe(true);
      expect(result.category).toBe(MAIN_COURSE_KIND);
    }
  });

  it('keeps a composed dish whose name mentions a sauce or a bread', () => {
    // The sauce in "Spaghetti w/ Marinara" must not demote the pasta.
    for (const dish of [
      'Spaghetti w/ Marinara',
      'Penne w/ Pesto & Sundried Tomato',
      'Pasta w/ Shrimp and Pesto',
      'Kale Caesar Pita',
      'Roasted Cauliflower Pita',
    ]) {
      expect(classifyMenuItem('Capri', dish).isMainCourse, dish).toBe(true);
    }
  });

  it('keeps a protein dish whose name also mentions a starch', () => {
    expect(classifyMenuItem('Alimenti', 'Lamb, Rice, & Swiss Chard Sauté').isMainCourse).toBe(true);
  });
});

describe('classifyMenuItem — unrecognised and missing stations', () => {
  it('promotes an entrée-shaped dish when the station is unknown', () => {
    const result = classifyMenuItem('Some Brand New Station', 'Grilled Chicken Breast');
    expect(result.isMainCourse).toBe(true);
    expect(result.classifiedBy).toBe('dish-name');
  });

  it('does not promote an accompaniment when the station is unknown', () => {
    for (const dish of ['Steamed Broccoli', 'Fresh Brewed Coffee', 'Chocolate Chip Cookie']) {
      expect(classifyMenuItem('Some Brand New Station', dish).isMainCourse, dish).toBe(false);
    }
  });

  it('handles a null or placeholder station without promoting a plain dish', () => {
    expect(classifyMenuItem(null, 'Assorted Crackers').isMainCourse).toBe(false);
    expect(classifyMenuItem('.', 'Assorted Crackers').isMainCourse).toBe(false);
    expect(classifyMenuItem('', 'Assorted Crackers').isMainCourse).toBe(false);
  });

  it('falls back to "other" rather than guessing', () => {
    const result = classifyMenuItem(null, 'Mystery Item');
    expect(result.category).toBe('other');
    expect(result.isMainCourse).toBe(false);
    expect(result.classifiedBy).toBe('default');
  });

  it('is deterministic — the same inputs always give the same answer', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(classifyMenuItem('Capri', 'Spaghetti Bolognese')).toEqual(
        classifyMenuItem('Capri', 'Spaghetti Bolognese'),
      );
    }
  });

  it('only ever returns a known category', () => {
    for (const dish of ['Cheese Pizza', 'Maple Syrup', 'Mystery Item', '']) {
      expect(MENU_CATEGORY_KINDS).toContain(classifyMenuItem('Alimenti', dish).category);
    }
  });
});

describe('menu parsing carries classification through', () => {
  const html = `
    <div class="at-a-glance-menu" id="lunchmenu">
      <div class="at-a-glance-menu__dining-location">
        <h3>Covel Dining</h3>
        <a href="/covel-dining-2">Detailed Menu</a>
        <div class="at-a-glance-menu__meal-station">
          <h4>The Grill/Psistaris</h4>
          <ul>
            <li><a href="/menu-item/?recipe=1">Bruin Cheese Burger</a>
              <img class="meal-station__allergen-icon" title="Halal" alt="Halal" src="x.svg">
              <img class="meal-station__allergen-icon" title="Wheat" alt="Wheat" src="y.svg"></li>
            <li><a href="/menu-item/?recipe=2">French Fries</a></li>
            <li><a href="/menu-item/?recipe=3">Greek Salad</a></li>
          </ul>
        </div>
        <div class="at-a-glance-menu__meal-station">
          <h4>Dolce</h4>
          <ul><li><a href="/menu-item/?recipe=4">Red Velvet Cake</a></li></ul>
        </div>
      </div>
    </div>`;

  it('classifies each parsed dish and keeps the published station', () => {
    const menus = parseMenuPage(html);
    const sections = menus.get('Covel Dining');
    expect(sections).toBeDefined();

    const items = sections![0].items;
    const byName = Object.fromEntries(items.map((item) => [item.name, item]));

    expect(byName['Bruin Cheese Burger'].isMainCourse).toBe(true);
    expect(byName['Bruin Cheese Burger'].station).toBe('The Grill/Psistaris');
    expect(byName['French Fries'].isMainCourse).toBe(false);
    expect(byName['Greek Salad'].isMainCourse).toBe(false);
    expect(byName['Red Velvet Cake'].isMainCourse).toBe(false);
    expect(byName['Red Velvet Cake'].category).toBe('dessert');
  });

  it('preserves the dietary labels UCLA published, unaltered', () => {
    const items = parseMenuPage(html).get('Covel Dining')![0].items;
    const burger = items.find((item) => item.name === 'Bruin Cheese Burger');

    expect(burger?.tags).toEqual(['Halal', 'Wheat']);
    expect(labelKind('Halal')).toBe('diet');
    expect(labelKind('Wheat')).toBe('allergen');
    expect(labelKind('Something Unrecognised')).toBe('other');
  });

  it('exposes exactly one main course for this fixture', () => {
    const day = buildDiningDay('2026-09-02', [], parseMenuPage(html));
    const venue = day.venues.find((entry) => entry.name === 'Covel Dining');
    const mains = venue!.menus.flatMap((section) => section.items.filter((i) => i.isMainCourse));

    expect(mains.map((item) => item.name)).toEqual(['Bruin Cheese Burger']);
  });
});

describe('category display configuration', () => {
  it('lists every category exactly once, main courses first', () => {
    expect(CATEGORY_DISPLAY_ORDER[0]).toBe(MAIN_COURSE_KIND);
    expect([...CATEGORY_DISPLAY_ORDER].sort()).toEqual([...MENU_CATEGORY_KINDS].sort());
  });
});
