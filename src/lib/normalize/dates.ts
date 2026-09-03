/**
 * Date handling.
 *
 * Upstream sources report dates in inconsistent formats and time zones. Every
 * adapter converts to ISO-8601 UTC through `toIso`; the UI formats for display
 * in UCLA's local time zone so "today" always means today on campus, whatever
 * the reader's own clock says.
 */

import { SITE } from '@/lib/config/site';

/** Parse an arbitrary upstream date string into ISO-8601 UTC, or null. */
export function toIso(input: string | number | Date | null | undefined): string | null {
  if (input === null || input === undefined || input === '') return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input.toISOString();
  }

  if (typeof input === 'number') {
    // Heuristic: values below 10^12 are second-precision Unix timestamps.
    const ms = input < 1e12 ? input * 1000 : input;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  // A bare `YYYY-MM-DD` is a calendar date; anchor it to noon UTC so that
  // rendering it in Los Angeles time never rolls it back to the previous day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00Z`).toISOString();
  }

  // WordPress `date` fields are local wall-clock with no offset. Treating them
  // as UTC would shift them; treat them as UCLA local time instead.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
    const asUtc = new Date(`${trimmed.replace(' ', 'T')}Z`);
    if (Number.isNaN(asUtc.getTime())) return null;
    const offsetMinutes = zoneOffsetMinutes(asUtc, SITE.timeZone);
    return new Date(asUtc.getTime() - offsetMinutes * 60_000).toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Offset of `timeZone` from UTC, in minutes, at the given instant. */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(at).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '00' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Calendar date at UCLA (`YYYY-MM-DD`) for a given instant. */
export function campusDate(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  return parts;
}

/** True when an ISO timestamp falls on the current calendar day at UCLA. */
export function isCampusToday(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return campusDate(date) === campusDate(now);
}

/** Absolute display date, e.g. "Mar 4, 2026". */
export function formatDate(iso: string | null, timeZone: string = SITE.timeZone): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Display time, e.g. "7:30 PM". */
export function formatTime(iso: string | null, timeZone: string = SITE.timeZone): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Coarse relative label, e.g. "3h ago". Falls back to an absolute date. */
export function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = now.getTime() - date.getTime();
  const future = diffMs < 0;
  const minutes = Math.round(Math.abs(diffMs) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days <= 7) return future ? `in ${days}d` : `${days}d ago`;

  return formatDate(iso);
}

/** Format a duration in seconds as `M:SS` or `H:MM:SS`. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/** Convert a local "HH:MM" wall-clock time on a campus date to ISO-8601 UTC. */
export function campusWallClockToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  const naive = new Date(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
  );
  if (Number.isNaN(naive.getTime())) return null;
  const offsetMinutes = zoneOffsetMinutes(naive, SITE.timeZone);
  return new Date(naive.getTime() - offsetMinutes * 60_000).toISOString();
}
