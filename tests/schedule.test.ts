import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER,
  REMINDER_PRESETS,
  isValidReminder,
  nextRunAfter,
  parseTime,
  type ReminderConfig,
} from '../src/core/schedule';

const MADRID = 'Europe/Madrid';

const workdays10: ReminderConfig = { enabled: true, weekdays: [1, 2, 3, 4, 5], time: '10:00' };

function iso(config: ReminderConfig, from: string, timeZone = MADRID): string | null {
  const next = nextRunAfter(config, new Date(from), timeZone);
  return next === null ? null : next.toISOString();
}

describe('parseTime', () => {
  it('accepts HH:MM in 24h', () => {
    expect(parseTime('10:00')).toEqual({ hours: 10, minutes: 0 });
    expect(parseTime('17:45')).toEqual({ hours: 17, minutes: 45 });
  });

  it('rejects anything else', () => {
    for (const input of ['', '24:00', '10:60', '9:00', '10', '10:00:00']) {
      expect(parseTime(input), input).toBeNull();
    }
  });
});

describe('isValidReminder', () => {
  it('accepts the presets and the default', () => {
    expect(isValidReminder(DEFAULT_REMINDER)).toBe(true);
    for (const preset of REMINDER_PRESETS) expect(isValidReminder(preset.config)).toBe(true);
  });

  it('rejects no weekdays, out-of-range days and a bad time', () => {
    expect(isValidReminder({ enabled: true, weekdays: [], time: '10:00' })).toBe(false);
    expect(isValidReminder({ enabled: true, weekdays: [0], time: '10:00' })).toBe(false);
    expect(isValidReminder({ enabled: true, weekdays: [8], time: '10:00' })).toBe(false);
    expect(isValidReminder({ enabled: true, weekdays: [1], time: '25:00' })).toBe(false);
  });
});

describe('nextRunAfter', () => {
  it('skips the weekend: Friday after 10:00 goes to Monday', () => {
    // Friday 2026-11-06, 11:00 in Madrid (CET, UTC+1).
    expect(iso(workdays10, '2026-11-06T10:00:00Z')).toBe('2026-11-09T09:00:00.000Z');
  });

  it('keeps today when the time has not passed yet', () => {
    // Friday 2026-11-06, 08:00 in Madrid.
    expect(iso(workdays10, '2026-11-06T07:00:00Z')).toBe('2026-11-06T09:00:00.000Z');
  });

  it('moves on when today is not an enabled day', () => {
    // Saturday 2026-11-07 → Monday.
    expect(iso(workdays10, '2026-11-07T09:00:00Z')).toBe('2026-11-09T09:00:00.000Z');
  });

  it('honours custom days', () => {
    const mondayAndWednesday: ReminderConfig = {
      enabled: true,
      weekdays: [1, 3],
      time: '10:00',
    };
    // Tuesday 2026-11-10 → Wednesday.
    expect(iso(mondayAndWednesday, '2026-11-10T09:00:00Z')).toBe('2026-11-11T09:00:00.000Z');
  });

  it('stays on the wall clock across the autumn DST change', () => {
    // Sunday 2026-10-25: Madrid leaves summer time at 03:00. 10:00 local is CET (UTC+1).
    const sundays: ReminderConfig = { enabled: true, weekdays: [7], time: '10:00' };

    expect(iso(sundays, '2026-10-24T12:00:00Z')).toBe('2026-10-25T09:00:00.000Z');
  });

  it('stays on the wall clock across the spring DST change', () => {
    // Sunday 2026-03-29: Madrid enters summer time at 02:00. 10:00 local is CEST (UTC+2).
    const sundays: ReminderConfig = { enabled: true, weekdays: [7], time: '10:00' };

    expect(iso(sundays, '2026-03-28T12:00:00Z')).toBe('2026-03-29T08:00:00.000Z');
  });

  it('follows the zone it is given', () => {
    expect(iso(workdays10, '2026-11-06T10:00:00Z', 'UTC')).toBe('2026-11-09T10:00:00.000Z');
  });

  it('returns nothing when it is disabled or misconfigured', () => {
    expect(iso({ ...workdays10, enabled: false }, '2026-11-06T10:00:00Z')).toBeNull();
    expect(iso({ ...workdays10, weekdays: [] }, '2026-11-06T10:00:00Z')).toBeNull();
    expect(iso({ ...workdays10, time: 'nunca' }, '2026-11-06T10:00:00Z')).toBeNull();
  });
});
