// Age / date-of-birth helpers — pure and timezone-aware by using LOCAL calendar
// dates (getFullYear/getMonth/getDate), never raw UTC milliseconds. This is the
// deciding logic for the 18+ onboarding gate, so it must be easy to verify.
//
// Eligibility rule: a user is at least `age` if their `age`-th birthday is TODAY
// or earlier, in the app's local timezone.
//
// Worked example (local "today" = 2026-07-01):
//   getMinimumBirthDateForAge(18) -> 2008-07-01
//   isAtLeastAge(2008-07-01, 18)  -> true   (turns 18 today → eligible)
//   isAtLeastAge(2008-07-02, 18)  -> false  (turns 18 tomorrow → not yet)
//   isAtLeastAge(2007-12-31, 18)  -> true   (already 18)

/** Strip the time component, keeping the LOCAL calendar date at midnight. */
function atLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * The latest birth date that still makes someone exactly `age` today.
 * Anyone born on or before this date qualifies as >= `age`.
 */
export function getMinimumBirthDateForAge(age: number, now: Date = new Date()): Date {
  const n = atLocalMidnight(now);
  return new Date(n.getFullYear() - age, n.getMonth(), n.getDate());
}

/**
 * True if `birthDate` means the person is at least `age` as of `now`, compared
 * on local calendar-date granularity (not milliseconds).
 */
export function isAtLeastAge(birthDate: Date, age: number, now: Date = new Date()): boolean {
  return atLocalMidnight(birthDate).getTime() <= getMinimumBirthDateForAge(age, now).getTime();
}

/** Year of the given birth date (compat value stored alongside birth_date). */
export function getBirthYearFromDate(birthDate: Date): number {
  return birthDate.getFullYear();
}

/** Whole-years age as of `now`, derived (never stored as source of truth). */
export function getAge(birthDate: Date, now: Date = new Date()): number {
  const n = atLocalMidnight(now);
  const b = atLocalMidnight(birthDate);
  let age = n.getFullYear() - b.getFullYear();
  const beforeBirthday =
    n.getMonth() < b.getMonth() ||
    (n.getMonth() === b.getMonth() && n.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Format a Date as a 'YYYY-MM-DD' string from its LOCAL components. We do NOT
 * use toISOString() because that converts to UTC and can shift the calendar day
 * across the date line for a date-only value.
 */
export function toISODateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a 'YYYY-MM-DD' string into a LOCAL Date (null if malformed). */
export function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Human-readable date for display, e.g. "Jul 1, 2008". */
export function formatBirthDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
