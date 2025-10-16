import { getNextDayOfWeek, calculateCycleAnchor, getCurrentCycleWithDayOfWeek } from './dateUtils';

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

describe('dateUtils - anchor day helpers', () => {
  test('getNextDayOfWeek returns same day when inclusive, otherwise next week', () => {
    const base = new Date();
    const dow = base.getDay();
    const inclusive = getNextDayOfWeek(base, dow, true);
    expect(inclusive.getDay()).toBe(dow);

    const exclusive = getNextDayOfWeek(base, dow, false);
    expect(exclusive.getDay()).toBe(dow);
    // exclusive should be at least +1 day ahead (typically +7 days)
    expect(exclusive.getTime()).toBeGreaterThan(base.getTime());
  });

  test('calculateCycleAnchor returns creation when on anchor day', () => {
    const creation = new Date();
    const anchorDow = creation.getDay();
    const anchor = calculateCycleAnchor(creation, anchorDow);
    expect(anchor.getDay()).toBe(anchorDow);
    expect(anchor.getDate()).toBe(creation.getDate());
  });

  test('getCurrentCycleWithDayOfWeek aligns start to anchor day and has correct length', () => {
    // Pick an arbitrary base date not on Sunday to force alignment
    const base = new Date();
    const task = { assigned_at: base.toISOString(), frequency_days: 10 };
    const anchorDow = 0; // Sunday
    const { cycleStart, cycleEnd } = getCurrentCycleWithDayOfWeek(task, anchorDow);
    expect(cycleStart.getDay()).toBe(anchorDow);
    const diffDays = Math.round((cycleEnd.getTime() - cycleStart.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(10);
  });
});


