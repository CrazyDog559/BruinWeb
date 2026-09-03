/**
 * Theme preference as an external store.
 *
 * The reader's choice lives in `localStorage`, which React cannot own — so it
 * is modelled as an external store and read with `useSyncExternalStore` rather
 * than copied into component state inside an effect. That keeps the server
 * render and the first client render consistent and avoids a cascading
 * re-render on mount.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'bruinweb-theme';

/** Notifies subscribers in this tab; the `storage` event covers other tabs. */
const CHANGE_EVENT = 'bruinweb:themechange';

function isChoice(value: string | null): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function subscribeToTheme(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    media.removeEventListener('change', onChange);
  };
}

export function readTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isChoice(stored) ? stored : 'system';
  } catch {
    // Private browsing can throw on access; treat that as "no preference".
    return 'system';
  }
}

/** During SSR there is no stored preference, so the neutral default applies. */
export function readServerTheme(): ThemeChoice {
  return 'system';
}

/** Apply a choice to the document and persist it. */
export function writeTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Persistence is a convenience; the theme still applies for this page.
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Reflect the effective theme onto `<html>`. Mirrors the inline head script. */
export function applyTheme(choice: ThemeChoice): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = choice === 'dark' || (choice === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
