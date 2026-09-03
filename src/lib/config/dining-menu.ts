/**
 * Dining menu classification.
 *
 * UCLA publishes each dish under a menu station (the `<h4>` inside
 * `at-a-glance-menu__meal-station`), and station names are brand names rather
 * than a clean taxonomy — "Capri", "Alimenti", "Dolce", "The Grill/Psistaris".
 * These tables map that real vocabulary onto a small taxonomy so the UI can
 * promote genuine entrées without any UI component knowing a dish name.
 *
 * Everything here is *category* configuration, not menu content: no current
 * dish is listed, and nothing needs editing when the menu changes.
 *
 * Precedence, implemented in `src/lib/adapters/dining.ts`:
 *   1. STATION_RULES map the station to a base category.
 *   2. STRONG_DEMOTE_DISH_RULES pull a dish out of `main` unconditionally — a
 *      station that serves entrées also serves porridge, salads and desserts.
 *   3. WEAK_DEMOTE_DISH_RULES demote only when the dish shows no entrée signal,
 *      so "Spaghetti w/ Marinara" stays a main while "Roasted Tomato Salsa"
 *      does not.
 *   4. ENTREE_DISH_SIGNALS may promote a dish to `main` ONLY when the station
 *      is unrecognised, so an unknown station still yields something useful.
 * A dish is never promoted on its name alone from a station we recognise as
 * desserts, sides, drinks or condiments.
 */

export const MENU_CATEGORY_KINDS = [
  'main',
  'side',
  'salad',
  'soup',
  'dessert',
  'bakery',
  'fruit',
  'beverage',
  'condiment',
  'other',
] as const;

export type MenuCategoryKind = (typeof MENU_CATEGORY_KINDS)[number];

/** The category the "Main Courses" group is built from. */
export const MAIN_COURSE_KIND: MenuCategoryKind = 'main';

export const MENU_CATEGORY_LABELS: Record<MenuCategoryKind, string> = {
  main: 'Main courses',
  side: 'Sides',
  salad: 'Salads',
  soup: 'Soups',
  dessert: 'Desserts',
  bakery: 'Bakery',
  fruit: 'Fruit',
  beverage: 'Drinks',
  condiment: 'Condiments',
  other: 'Other',
};

interface CategoryRule {
  pattern: RegExp;
  kind: MenuCategoryKind;
}

/**
 * Station name → category. Ordered; the first match wins, so put narrow
 * patterns above broad ones ("Capri Pizza" must beat "Capri").
 *
 * Patterns cover both the station names observed on the live site and the
 * standard UCLA residential-restaurant vocabulary that appears in full term
 * service (Exhibition Kitchen, Flexitarian, Harvest, Freshly Bowled, and so on).
 */
export const STATION_RULES: CategoryRule[] = [
  // --- Explicitly not main courses (checked first) ---
  { pattern: /condiment|dressing|sauce|topping|spread|syrup|butter bar/i, kind: 'condiment' },
  { pattern: /dessert|dolce|sweet|gelato|ice cream|creamery|pastry cart/i, kind: 'dessert' },
  { pattern: /bakery|bakeshop|bread|bagel|pastries|muffin/i, kind: 'bakery' },
  { pattern: /beverage|drink|coffee|espresso|tea bar|juice|smoothie/i, kind: 'beverage' },
  { pattern: /^fruit|fruit bar|melon/i, kind: 'fruit' },
  { pattern: /yogurt|parfait|cereal|oatmeal bar|breakfast bar/i, kind: 'side' },
  { pattern: /salad bar|salads?$|greens|crisp/i, kind: 'salad' },
  { pattern: /soup|broth|stock pot/i, kind: 'soup' },
  { pattern: /mezze|antipasti|appetizer|dips|side/i, kind: 'side' },

  // --- Substantial meal stations ---
  { pattern: /pizza|pizzeria|forno/i, kind: 'main' },
  { pattern: /grill|psistaris|griddle|char|flame/i, kind: 'main' },
  { pattern: /exhibition|kitchen|chef|entree|entrée|main|centerpiece/i, kind: 'main' },
  { pattern: /bowl|freshly bowled|noodle|ramen|pho|wok|stir fry|stir-fry/i, kind: 'main' },
  { pattern: /pasta|capri|alimenti|trattoria|cucina/i, kind: 'main' },
  { pattern: /taco|taqueria|burrito|cocina|mexican/i, kind: 'main' },
  { pattern: /sandwich|deli|panini|burger|hoagie|sub shop/i, kind: 'main' },
  { pattern: /flexitarian|harvest|vegan station|plant/i, kind: 'main' },
  { pattern: /rotisserie|roast|carve|braise|tandoor|curry|india/i, kind: 'main' },
  { pattern: /breakfast|scramble|omelet|omelette/i, kind: 'main' },
];

/**
 * Dishes that are never a main course, whatever station serves them.
 *
 * These categories are unambiguous: a dessert is a dessert even at the grill,
 * and a side salad served at a pasta station is still a salad. Applied before
 * any entrée signal, so they win outright.
 *
 * Consequence worth stating: a composed "entrée salad" is demoted to `salad`.
 * That is the deliberate direction to err — the brief asks that sides never be
 * promoted, so a main hidden among the salads is the cheaper mistake.
 */
export const STRONG_DEMOTE_DISH_RULES: CategoryRule[] = [
  {
    pattern:
      /\b(cookie|brownie|cake|pie|tart|muffin|scone|donut|doughnut|pudding|gelato|ice cream|cobbler|churro|dulce de leche|danish|mousse|cupcake|streusel)\b/i,
    kind: 'dessert',
  },
  {
    pattern:
      /\b(coffee|latte|espresso|juice|lemonade|milk|smoothie|soda|tea|horchata|water|cider)\b/i,
    kind: 'beverage',
  },
  {
    pattern:
      /\b(cantaloupe|honeydew|watermelon|pineapple|grapefruit|berries|blueberries|strawberries|banana|melon|grapes|apple slices)\b/i,
    kind: 'fruit',
  },
  { pattern: /\b(soup|chowder|bisque|broth)\b/i, kind: 'soup' },
  { pattern: /\bsalad\b/i, kind: 'salad' },
  {
    pattern: /\b(oatmeal|cream of wheat|porridge|grits|granola|yogurt|cottage cheese)\b/i,
    kind: 'side',
  },
  // Unambiguous breakfast and bar accompaniments.
  {
    pattern:
      /\b(hash brown|sausage link|sausage patty|topping|chips|crackers|pretzels|trail mix)\b|^bacon$/i,
    kind: 'side',
  },
];

/**
 * Dishes that are usually an accompaniment but can legitimately be part of an
 * entrée's name — "Spaghetti w/ Marinara" is a main course, "Roasted Tomato
 * Salsa" is not; "Kale Caesar Pita" is a main course, "Plain Bagel" is not.
 *
 * These demote only when the dish carries no `ENTREE_DISH_SIGNALS` match, so
 * the sauce or the bread in a composed dish does not disqualify it.
 */
export const WEAK_DEMOTE_DISH_RULES: CategoryRule[] = [
  {
    pattern:
      /\b(dressing|vinaigrette|aioli|salsa|pesto|hummus|marinara|gravy|syrup|jam|jelly|cream cheese|butter|spread|dip)\b/i,
    kind: 'condiment',
  },
  {
    pattern: /\b(bagel|toast|croissant|baguette|roll|biscuit|tortilla|pita|focaccia|bread)\b/i,
    kind: 'bakery',
  },
  {
    pattern:
      /\b(steamed|roasted|sauteed|sautéed|grilled|braised)\s+(vegetable|veggie|broccoli|carrot|beet|zucchini|cauliflower|asparagus|green bean|brussels|squash|mushroom|spinach|kale|corn)/i,
    kind: 'side',
  },
  // Starches. A dish that also names a protein keeps its entrée signal and stays.
  {
    pattern: /\b(potatoes?|rice|polenta|couscous|quinoa|beans|french fries|tater tots|lentils)\b/i,
    kind: 'side',
  },
];

/**
 * Dish-name signals that mark a substantial protein or composed plate.
 *
 * Two jobs: they promote a dish when the station is unrecognised, and they
 * protect a composed dish from the weak demotion rules above.
 */
export const ENTREE_DISH_SIGNALS: RegExp =
  /\b(chicken|beef|steak|pork|ribs|turkey|lamb|duck|salmon|tilapia|cod|halibut|shrimp|fish|tofu|tempeh|seitan|falafel|burger|sandwich|wrap|pita|flatbread|panini|hot dog|burrito|taco|enchilada|lasagna|pasta|spaghetti|penne|rigatoni|rotini|linguine|fettuccine|noodle|pizza|curry|stir[- ]?fry|casserole|meatball|schnitzel|kebab|gyro|quesadilla|risotto|paella|stew|saut[\u00e9e]|scramble|omelet|omelette|frittata|waffle|pancake|drumstick|wings?)\b/i;

/**
 * Station names that carry no information and should not be shown as a group
 * heading — the source occasionally emits a placeholder.
 */
export const EMPTY_STATION_PATTERN = /^[\s.·—-]*$/;

/** Order the full menu is displayed in, beneath the promoted main courses. */
export const CATEGORY_DISPLAY_ORDER: MenuCategoryKind[] = [
  'main',
  'salad',
  'soup',
  'side',
  'bakery',
  'fruit',
  'dessert',
  'beverage',
  'condiment',
  'other',
];

/**
 * Dietary and allergen labels UCLA attaches to a dish, as icon `title` values.
 * We display exactly what the source says and never infer a medical or
 * allergen claim — `diet` labels are shown as positive attributes, `allergen`
 * labels are shown as "contains" information.
 */
export const DIET_LABELS = ['Vegan', 'Vegetarian', 'Halal', 'Low Carbon', 'High-carbon'] as const;

export const ALLERGEN_LABELS = [
  'Dairy',
  'Egg',
  'Fish',
  'Gluten',
  'Peanuts',
  'Sesame',
  'Shellfish',
  'Soy',
  'Tree-nuts',
  'Wheat',
] as const;

export type DietLabel = (typeof DIET_LABELS)[number];

/** Classify a UCLA-supplied label without reinterpreting it. */
export function labelKind(label: string): 'diet' | 'allergen' | 'other' {
  const normalized = label.trim().toLowerCase();
  if (DIET_LABELS.some((entry) => entry.toLowerCase() === normalized)) return 'diet';
  if (ALLERGEN_LABELS.some((entry) => entry.toLowerCase() === normalized)) return 'allergen';
  return 'other';
}
