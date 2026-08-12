import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateRecurrenceInstances } from './recurrence';
import type { RecurrenceRule } from '@/types/task';

/**
 * Property 11: 週期任務生成
 * **Validates: Requirements 5.2**
 *
 * For any valid RecurrenceRule, the generated recurrence instances
 * must conform to the defined frequency, interval, and end conditions.
 */

// Helper: parse YYYY-MM-DD to Date
const parseDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

// Helper: diff in days between two date strings
const daysDiff = (a: string, b: string): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / msPerDay);
};

// Arbitrary: valid start date within a 2-year range
const arbStartDate = fc.integer({ min: 0, max: 730 }).map((offset) => {
  const base = new Date('2024-01-01');
  base.setDate(base.getDate() + offset);
  const year = base.getFullYear();
  const month = (base.getMonth() + 1).toString().padStart(2, '0');
  const day = base.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
});

// Arbitrary: interval (1 to 12)
const arbInterval = fc.integer({ min: 1, max: 12 });

// Arbitrary: end count (1 to 50)
const arbEndCount = fc.integer({ min: 1, max: 50 });

// Arbitrary: days of week (subset of 0-6, non-empty)
const arbDaysOfWeek = fc
  .subarray([0, 1, 2, 3, 4, 5, 6], { minLength: 1, maxLength: 7 })
  .map((arr) => arr.sort((a, b) => a - b));

// Arbitrary: day of month (1 to 28, to avoid edge cases with short months for basic property tests)
const arbDayOfMonth = fc.integer({ min: 1, max: 28 });

describe('Property 11: 週期任務生成 (Recurrence Instance Generation)', () => {
  /**
   * Property 11.1: For 'count' endType, exactly endCount instances are generated.
   * **Validates: Requirements 5.2**
   */
  describe('count endType: generates exactly endCount instances', () => {
    it('daily frequency with count endType', () => {
      fc.assert(
        fc.property(arbStartDate, arbInterval, arbEndCount, (startDate, interval, endCount) => {
          const rule: RecurrenceRule = {
            frequency: 'daily',
            interval,
            endType: 'count',
            endCount,
          };

          const instances = generateRecurrenceInstances(startDate, rule);
          expect(instances).toHaveLength(endCount);
        }),
        { numRuns: 200 },
      );
    });

    it('weekly frequency with count endType (no daysOfWeek)', () => {
      fc.assert(
        fc.property(arbStartDate, arbInterval, arbEndCount, (startDate, interval, endCount) => {
          const rule: RecurrenceRule = {
            frequency: 'weekly',
            interval,
            endType: 'count',
            endCount,
          };

          const instances = generateRecurrenceInstances(startDate, rule);
          expect(instances).toHaveLength(endCount);
        }),
        { numRuns: 200 },
      );
    });

    it('monthly frequency with count endType', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          arbInterval,
          arbEndCount.map((c) => Math.min(c, 24)), // limit to 24 for monthly
          (startDate, interval, endCount) => {
            const rule: RecurrenceRule = {
              frequency: 'monthly',
              interval,
              endType: 'count',
              endCount,
            };

            const instances = generateRecurrenceInstances(startDate, rule);
            expect(instances).toHaveLength(endCount);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('custom frequency with count endType', () => {
      fc.assert(
        fc.property(arbStartDate, arbInterval, arbEndCount, (startDate, interval, endCount) => {
          const rule: RecurrenceRule = {
            frequency: 'custom',
            interval,
            endType: 'count',
            endCount,
          };

          const instances = generateRecurrenceInstances(startDate, rule);
          expect(instances).toHaveLength(endCount);
        }),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 11.2: For 'date' endType, all instances are <= endDate.
   * **Validates: Requirements 5.2**
   */
  describe('date endType: all instances are within the date range', () => {
    it('all instances are <= endDate for daily frequency', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          arbInterval,
          fc.integer({ min: 7, max: 365 }), // days after start for end date
          (startDate, interval, daysAfter) => {
            const endDateObj = parseDate(startDate);
            endDateObj.setDate(endDateObj.getDate() + daysAfter);
            const endDate = `${endDateObj.getFullYear()}-${(endDateObj.getMonth() + 1).toString().padStart(2, '0')}-${endDateObj.getDate().toString().padStart(2, '0')}`;

            const rule: RecurrenceRule = {
              frequency: 'daily',
              interval,
              endType: 'date',
              endDate,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            // All instances should be <= endDate
            for (const inst of instances) {
              expect(parseDate(inst).getTime()).toBeLessThanOrEqual(parseDate(endDate).getTime());
            }

            // At least one instance should be generated (startDate <= endDate)
            expect(instances.length).toBeGreaterThan(0);

            // First instance should be the start date
            expect(instances[0]).toBe(startDate);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('no gap exists where another valid instance would fit for daily frequency', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          arbInterval,
          fc.integer({ min: 7, max: 180 }),
          (startDate, interval, daysAfter) => {
            const endDateObj = parseDate(startDate);
            endDateObj.setDate(endDateObj.getDate() + daysAfter);
            const endDate = `${endDateObj.getFullYear()}-${(endDateObj.getMonth() + 1).toString().padStart(2, '0')}-${endDateObj.getDate().toString().padStart(2, '0')}`;

            const rule: RecurrenceRule = {
              frequency: 'daily',
              interval,
              endType: 'date',
              endDate,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            if (instances.length > 0) {
              // The last instance + interval should exceed the end date
              const lastInstance = instances[instances.length - 1]!;
              const nextWouldBe = parseDate(lastInstance);
              nextWouldBe.setDate(nextWouldBe.getDate() + interval);
              expect(nextWouldBe.getTime()).toBeGreaterThan(parseDate(endDate).getTime());
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 11.3: For 'daily' frequency, consecutive instances are exactly `interval` days apart.
   * **Validates: Requirements 5.2**
   */
  describe('daily frequency: consecutive instances are interval days apart', () => {
    it('each consecutive pair differs by exactly interval days', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          arbInterval,
          fc.integer({ min: 2, max: 30 }),
          (startDate, interval, count) => {
            const rule: RecurrenceRule = {
              frequency: 'daily',
              interval,
              endType: 'count',
              endCount: count,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            for (let i = 1; i < instances.length; i++) {
              const diff = daysDiff(instances[i - 1]!, instances[i]!);
              expect(diff).toBe(interval);
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it('custom frequency behaves like daily with interval days apart', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          arbInterval,
          fc.integer({ min: 2, max: 30 }),
          (startDate, interval, count) => {
            const rule: RecurrenceRule = {
              frequency: 'custom',
              interval,
              endType: 'count',
              endCount: count,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            for (let i = 1; i < instances.length; i++) {
              const diff = daysDiff(instances[i - 1]!, instances[i]!);
              expect(diff).toBe(interval);
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 11.4: For 'weekly' frequency, instances fall on correct days of week.
   * **Validates: Requirements 5.2**
   */
  describe('weekly frequency: instances fall on correct days of week', () => {
    it('all instances fall on specified daysOfWeek', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          fc.integer({ min: 1, max: 4 }),
          arbDaysOfWeek,
          fc.integer({ min: 2, max: 20 }),
          (startDate, interval, daysOfWeek, count) => {
            // Ensure startDate falls on one of the daysOfWeek for a clean test
            const startDow = parseDate(startDate).getDay();
            fc.pre(daysOfWeek.includes(startDow));

            const rule: RecurrenceRule = {
              frequency: 'weekly',
              interval,
              daysOfWeek,
              endType: 'count',
              endCount: count,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            // All instances must fall on one of the specified days of week
            for (const inst of instances) {
              const dow = parseDate(inst).getDay();
              expect(daysOfWeek).toContain(dow);
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it('weekly without daysOfWeek: instances are interval*7 days apart', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          fc.integer({ min: 1, max: 4 }),
          fc.integer({ min: 2, max: 15 }),
          (startDate, interval, count) => {
            const rule: RecurrenceRule = {
              frequency: 'weekly',
              interval,
              endType: 'count',
              endCount: count,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            for (let i = 1; i < instances.length; i++) {
              const diff = daysDiff(instances[i - 1]!, instances[i]!);
              expect(diff).toBe(interval * 7);
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Property 11.5: For 'monthly' frequency, instances fall on correct day of month.
   * **Validates: Requirements 5.2**
   */
  describe('monthly frequency: instances fall on correct day of month', () => {
    it('all instances fall on specified dayOfMonth', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          fc.integer({ min: 1, max: 3 }),
          arbDayOfMonth,
          fc.integer({ min: 2, max: 12 }),
          (startDate, interval, dayOfMonth, count) => {
            // Ensure startDate's day matches dayOfMonth for clean results
            const startDay = parseDate(startDate).getDate();
            fc.pre(startDay === dayOfMonth);

            const rule: RecurrenceRule = {
              frequency: 'monthly',
              interval,
              dayOfMonth,
              endType: 'count',
              endCount: count,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            // All instances must fall on the specified day of month
            // (or last day of month if month is shorter)
            for (const inst of instances) {
              const date = parseDate(inst);
              const actualDay = date.getDate();
              const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

              if (dayOfMonth <= lastDayOfMonth) {
                expect(actualDay).toBe(dayOfMonth);
              } else {
                // Falls on last day of month when dayOfMonth exceeds month length
                expect(actualDay).toBe(lastDayOfMonth);
              }
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it('monthly instances are spaced by interval months', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 2, max: 12 }),
          (startDate, interval, count) => {
            const rule: RecurrenceRule = {
              frequency: 'monthly',
              interval,
              endType: 'count',
              endCount: count,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            // Consecutive instances should be approximately interval months apart
            for (let i = 1; i < instances.length; i++) {
              const prev = parseDate(instances[i - 1]!);
              const curr = parseDate(instances[i]!);

              const monthDiff =
                (curr.getFullYear() - prev.getFullYear()) * 12 +
                (curr.getMonth() - prev.getMonth());

              expect(monthDiff).toBe(interval);
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Additional property: For 'never' endType, at most 52 instances are generated.
   * **Validates: Requirements 5.2**
   */
  describe('never endType: generates reasonable max instances', () => {
    it('generates at most 52 instances for daily frequency', () => {
      fc.assert(
        fc.property(arbStartDate, arbInterval, (startDate, interval) => {
          const rule: RecurrenceRule = {
            frequency: 'daily',
            interval,
            endType: 'never',
          };

          const instances = generateRecurrenceInstances(startDate, rule);
          expect(instances.length).toBeLessThanOrEqual(52);
          expect(instances.length).toBe(52);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * General invariant: all instances should be in non-decreasing chronological order.
   * **Validates: Requirements 5.2**
   */
  describe('general invariant: instances are chronologically ordered', () => {
    it('instances are in ascending date order', () => {
      fc.assert(
        fc.property(
          arbStartDate,
          fc.constantFrom<RecurrenceRule['frequency']>('daily', 'weekly', 'monthly', 'custom'),
          arbInterval,
          fc.integer({ min: 2, max: 20 }),
          (startDate, frequency, interval, count) => {
            const rule: RecurrenceRule = {
              frequency,
              interval,
              endType: 'count',
              endCount: count,
            };

            const instances = generateRecurrenceInstances(startDate, rule);

            for (let i = 1; i < instances.length; i++) {
              const prevTime = parseDate(instances[i - 1]!).getTime();
              const currTime = parseDate(instances[i]!).getTime();
              expect(currTime).toBeGreaterThan(prevTime);
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * Invariant: first instance should always be the start date (when it matches rule).
   * **Validates: Requirements 5.2**
   */
  describe('first instance is the start date', () => {
    it('daily frequency starts on startDate', () => {
      fc.assert(
        fc.property(arbStartDate, arbInterval, (startDate, interval) => {
          const rule: RecurrenceRule = {
            frequency: 'daily',
            interval,
            endType: 'count',
            endCount: 5,
          };

          const instances = generateRecurrenceInstances(startDate, rule);
          expect(instances[0]).toBe(startDate);
        }),
        { numRuns: 100 },
      );
    });
  });
});
