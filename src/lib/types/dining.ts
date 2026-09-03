import type { MenuCategoryKind } from '@/lib/config/dining-menu';

/**
 * Dining-specific structures. Owned entirely by the dining adapter — the shared
 * `MediaItem` contract does not know about meal periods or menu sections.
 */

export const MEAL_PERIODS = ['breakfast', 'brunch', 'lunch', 'dinner', 'late-night'] as const;

export type MealPeriod = (typeof MEAL_PERIODS)[number];

export const MEAL_PERIOD_LABELS: Record<MealPeriod, string> = {
  breakfast: 'Breakfast',
  brunch: 'Brunch',
  lunch: 'Lunch',
  dinner: 'Dinner',
  'late-night': 'Late Night',
};

/** Residential dining hall vs. quick-service / takeout venue. */
export type DiningVenueKind = 'residential-restaurant' | 'quick-service';

export interface DiningHours {
  period: MealPeriod;
  /** Local wall-clock time at UCLA, 24h "HH:MM". */
  opens: string;
  closes: string;
}

export interface DiningMenuItem {
  id: string;
  name: string;
  /** Menu station as published, e.g. "The Grill/Psistaris". Null if omitted. */
  station: string | null;
  /** Dietary and allergen labels exactly as published by UCLA. */
  tags: string[];
  url: string | null;
  /** Normalized category. Derived by the dining adapter, never by the UI. */
  category: MenuCategoryKind;
  /** True when this is a substantial entrée worth promoting. */
  isMainCourse: boolean;
  /**
   * Why the classifier landed on `category`. Kept for debugging and for the
   * tests that guard against sides being promoted.
   */
  classifiedBy: 'station' | 'dish-name' | 'station-then-dish-name' | 'default';
}

export interface DiningMenuSection {
  period: MealPeriod;
  items: DiningMenuItem[];
}

export interface DiningVenue {
  id: string;
  name: string;
  kind: DiningVenueKind;
  url: string;
  /** Free-text campus location, e.g. "Sproul Hall, Level 1". */
  location: string | null;
  /** Hours for the date this payload describes. */
  hours: DiningHours[];
  /** Menus for the date this payload describes. May be empty if not published. */
  menus: DiningMenuSection[];
  /** Whether the venue serves at all on this date. */
  open: boolean;
}

export interface DiningDay {
  /** Calendar date at UCLA in `YYYY-MM-DD`. */
  date: string;
  venues: DiningVenue[];
}
