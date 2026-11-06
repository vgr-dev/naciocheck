/**
 * Reminders: which weekdays and at what local time.
 *
 * Pure date arithmetic over an explicit time zone, so the tests are the same on any machine and a DST change
 * does not move the reminder off 10:00. `browser.alarms` only receives the resulting instant.
 */

export interface ReminderConfig {
  enabled: boolean;
  /** ISO weekday numbers: 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  /** `HH:MM`, in the user's local time. */
  time: string;
}

export const DEFAULT_REMINDER: ReminderConfig = {
  enabled: false,
  weekdays: [1, 2, 3, 4, 5],
  time: '10:00',
};

export interface ReminderPreset {
  id: string;
  config: ReminderConfig;
}

export const REMINDER_PRESETS: readonly ReminderPreset[] = [
  { id: 'workdays-10', config: { enabled: true, weekdays: [1, 2, 3, 4, 5], time: '10:00' } },
  { id: 'workdays-17', config: { enabled: true, weekdays: [1, 2, 3, 4, 5], time: '17:00' } },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTime(time: string): { hours: number; minutes: number } | null {
  const match = TIME_PATTERN.exec(time);
  if (match === null) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function isValidReminder(config: ReminderConfig): boolean {
  return (
    parseTime(config.time) !== null &&
    config.weekdays.length > 0 &&
    config.weekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)
  );
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // `hour` comes back as 24 for midnight in some engines.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** How far ahead of UTC the zone is at that instant, in milliseconds. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = zonedParts(new Date(instantMs), timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return asUtc - instantMs;
}

/** The instant at which the zone shows this wall-clock time. */
function zonedWallClockToUtc(parts: ZonedParts, timeZone: string): number {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  // Two passes settle the offset across a DST boundary.
  const firstTry = guess - zoneOffsetMs(guess, timeZone);
  return guess - zoneOffsetMs(firstTry, timeZone);
}

/** ISO weekday (1 = Monday) of a calendar date. */
function isoWeekday(year: number, month: number, day: number): number {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/**
 * The next instant the reminder should fire, or `null` when it is disabled or misconfigured.
 * A time that has already passed today moves to the next enabled day.
 */
export function nextRunAfter(
  config: ReminderConfig,
  from: Date,
  timeZone: string = localTimeZone(),
): Date | null {
  if (!config.enabled || !isValidReminder(config)) return null;
  const time = parseTime(config.time);
  if (time === null) return null;

  const today = zonedParts(from, timeZone);
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const parts: ZonedParts = {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
      hour: time.hours,
      minute: time.minutes,
    };
    if (!config.weekdays.includes(isoWeekday(parts.year, parts.month, parts.day))) continue;
    const instant = zonedWallClockToUtc(parts, timeZone);
    if (instant > from.getTime()) return new Date(instant);
  }
  return null;
}

/** The `when` a `browser.alarms` call needs, or `null` when there is nothing to schedule. */
export function nextRunWhen(
  config: ReminderConfig,
  from: Date,
  timeZone: string = localTimeZone(),
): number | null {
  return nextRunAfter(config, from, timeZone)?.getTime() ?? null;
}
