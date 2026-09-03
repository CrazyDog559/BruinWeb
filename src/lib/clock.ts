/**
 * The current campus day, as an external store.
 *
 * BruinWeb is a build-time snapshot, so "is this menu still today's menu?" can
 * only be answered in the reader's browser. Reading the clock during render
 * would desynchronise the server HTML from hydration, and reading it in an
 * effect means setting state in an effect. Modelling it as an external store
 * avoids both: `getServerSnapshot` reports the build-time answer, the client
 * re-renders once with the real one, and the cached object keeps its identity
 * between renders so `useSyncExternalStore` does not loop.
 */

import { campusDate } from '@/lib/normalize';

interface CampusDay {
  /** `YYYY-MM-DD` at UCLA, or '' before the client has read the clock. */
  date: string;
}

const SERVER_SNAPSHOT: CampusDay = { date: '' };

let snapshot: CampusDay = SERVER_SNAPSHOT;

/** How often to re-check. A minute is ample for a date that changes daily. */
const TICK_MS = 60_000;

export function subscribeToCampusDay(onChange: () => void): () => void {
  const timer = setInterval(() => {
    if (campusDate() !== snapshot.date) onChange();
  }, TICK_MS);

  // A laptop waking from sleep can skip the interval entirely.
  const onVisibility = () => {
    if (campusDate() !== snapshot.date) onChange();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export function getCampusDaySnapshot(): CampusDay {
  const today = campusDate();
  // Return the cached object unless the day actually changed, so repeated
  // renders see a stable reference.
  if (today !== snapshot.date) snapshot = { date: today };
  return snapshot;
}

export function getCampusDayServerSnapshot(): CampusDay {
  return SERVER_SNAPSHOT;
}
