/**
 * 測試對象：src/utils/alertRules.ts
 * 涵蓋六項排班警示規則檢查器（證照要求、連續工作日、每日工時、
 * 時段重複、指定休假、人數不足）以及 runAlertChecks 主入口，
 * 包含一般案例測試與 property-based tests（fast-check）驗證規則邊界行為。
 */
import { describe, it, expect } from 'vitest';
import {
  checkLicenseRequired,
  checkConsecutiveDays,
  checkDailyHoursExceeded,
  checkDuplicateSlot,
  checkDesignatedLeave,
  checkHeadcountBelowMin,
  runAlertChecks,
} from './alertRules';
import type { TaskFormData, Task } from '@/types/task';
import type { AlertContext } from '@/types/alert';
import type { Employee } from '@/types/employee';

const makeTask = (overrides: Partial<TaskFormData> = {}): TaskFormData => ({
  groupId: 'g1',
  branchId: 'b1',
  taskType: 'CONTRACT',
  date: '2025-06-15',
  startTime: '09:00',
  endTime: '17:00',
  headcount: 2,
  shift: 'DAY',
  route: 'R1',
  contents: ['P'],
  assignees: ['emp1', 'emp2'],
  ...overrides,
});

const makeEmployee = (id: string, overrides: Partial<Employee> = {}): Employee => ({
  id,
  name: `Employee ${id}`,
  phone: '0912345678',
  employeeNo: `E${id}`,
  position: 'STAFF',
  groupId: 'g1',
  groupName: 'Group 1',
  groupColor: '#FF0000',
  designatedLeaves: [],
  licenses: ['NONE'],
  isActive: true,
  ...overrides,
});

const makeExistingTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  groupId: 'g1',
  groupName: 'Group 1',
  branchId: 'b1',
  branchName: 'Branch 1',
  taskType: 'CONTRACT',
  date: '2025-06-15',
  startTime: '09:00',
  endTime: '17:00',
  isOvernight: false,
  headcount: 2,
  shift: 'DAY',
  route: 'R1',
  contents: ['P'],
  assignees: [{ employeeId: 'emp1', employeeName: 'E1', licenses: ['NONE'] }],
  status: 'SCHEDULED',
  alertStatus: 'CLEAN',
  createdBy: 'admin',
  createdAt: '2025-06-01T00:00:00+08:00',
  updatedAt: '2025-06-01T00:00:00+08:00',
  ...overrides,
});

const makeContext = (overrides: Partial<AlertContext> = {}): AlertContext => ({
  employees: [makeEmployee('emp1'), makeEmployee('emp2')],
  existingTasks: [],
  customerLicenses: [],
  holidays: [],
  ...overrides,
});

describe('checkLicenseRequired', () => {
  it('returns null when no license required', () => {
    const task = makeTask();
    const context = makeContext({ customerLicenses: [] });
    expect(checkLicenseRequired(task, context)).toBeNull();
  });

  it('returns null when only NONE is required', () => {
    const task = makeTask();
    const context = makeContext({ customerLicenses: ['NONE'] });
    expect(checkLicenseRequired(task, context)).toBeNull();
  });

  it('returns violation when no employee has required license', () => {
    const task = makeTask();
    const context = makeContext({ customerLicenses: ['PEST_CONTROL'] });
    const result = checkLicenseRequired(task, context);
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('LICENSE_REQUIRED');
  });

  it('returns null when at least one employee has required license', () => {
    const task = makeTask();
    const context = makeContext({
      customerLicenses: ['PEST_CONTROL'],
      employees: [makeEmployee('emp1', { licenses: ['PEST_CONTROL'] }), makeEmployee('emp2')],
    });
    expect(checkLicenseRequired(task, context)).toBeNull();
  });
});

describe('checkConsecutiveDays', () => {
  it('returns null when consecutive days <= 7', () => {
    const task = makeTask({ date: '2025-06-08' });
    const existingTasks = Array.from({ length: 6 }, (_, i) =>
      makeExistingTask({
        id: `t${i}`,
        date: `2025-06-0${i + 2}`,
        assignees: [{ employeeId: 'emp1', employeeName: 'E1', licenses: ['NONE'] }],
      }),
    );
    const context = makeContext({ existingTasks });
    expect(checkConsecutiveDays(task, context)).toBeNull();
  });

  it('returns violation when consecutive days > 7', () => {
    const task = makeTask({ date: '2025-06-09' });
    const existingTasks = Array.from({ length: 7 }, (_, i) =>
      makeExistingTask({
        id: `t${i}`,
        date: `2025-06-0${i + 2}`,
        assignees: [{ employeeId: 'emp1', employeeName: 'E1', licenses: ['NONE'] }],
      }),
    );
    const context = makeContext({ existingTasks });
    const result = checkConsecutiveDays(task, context);
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('CONSECUTIVE_DAYS');
  });
});

describe('checkDailyHoursExceeded', () => {
  it('returns null when total hours <= 10', () => {
    const task = makeTask({ startTime: '09:00', endTime: '12:00' }); // 3 hours
    const existingTasks = [
      makeExistingTask({ startTime: '13:00', endTime: '19:00' }), // 6 hours
    ];
    const context = makeContext({ existingTasks });
    expect(checkDailyHoursExceeded(task, context)).toBeNull();
  });

  it('returns violation when total hours > 10', () => {
    const task = makeTask({ startTime: '09:00', endTime: '17:00' }); // 8 hours
    const existingTasks = [
      makeExistingTask({ startTime: '18:00', endTime: '21:00' }), // 3 hours = total 11
    ];
    const context = makeContext({ existingTasks });
    const result = checkDailyHoursExceeded(task, context);
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('DAILY_HOURS_EXCEEDED');
  });
});

describe('checkDuplicateSlot', () => {
  it('returns null when no time overlap', () => {
    const task = makeTask({ startTime: '09:00', endTime: '12:00' });
    const existingTasks = [makeExistingTask({ startTime: '13:00', endTime: '17:00' })];
    const context = makeContext({ existingTasks });
    expect(checkDuplicateSlot(task, context)).toBeNull();
  });

  it('returns violation when time overlaps', () => {
    const task = makeTask({ startTime: '10:00', endTime: '14:00' });
    const existingTasks = [makeExistingTask({ startTime: '09:00', endTime: '12:00' })];
    const context = makeContext({ existingTasks });
    const result = checkDuplicateSlot(task, context);
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('DUPLICATE_SLOT');
  });
});

describe('checkDesignatedLeave', () => {
  it('returns null when no employee is on leave', () => {
    const task = makeTask();
    const context = makeContext();
    expect(checkDesignatedLeave(task, context)).toBeNull();
  });

  it('returns violation when employee is on designated leave', () => {
    const task = makeTask({ date: '2025-06-15' });
    const context = makeContext({
      employees: [makeEmployee('emp1', { designatedLeaves: ['2025-06-15'] }), makeEmployee('emp2')],
    });
    const result = checkDesignatedLeave(task, context);
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('DESIGNATED_LEAVE');
    expect(result?.affectedEmployees).toContain('emp1');
  });
});

describe('checkHeadcountBelowMin', () => {
  it('returns null when headcount is met', () => {
    const task = makeTask({ headcount: 2, assignees: ['emp1', 'emp2'] });
    expect(checkHeadcountBelowMin(task, makeContext())).toBeNull();
  });

  it('returns violation when assignees < headcount', () => {
    const task = makeTask({ headcount: 3, assignees: ['emp1', 'emp2'] });
    const result = checkHeadcountBelowMin(task, makeContext());
    expect(result).not.toBeNull();
    expect(result?.ruleId).toBe('HEADCOUNT_BELOW_MIN');
    expect(result?.details).toEqual({ required: 3, actual: 2 });
  });
});

describe('runAlertChecks', () => {
  it('returns valid when no violations', () => {
    const task = makeTask();
    const context = makeContext();
    const result = runAlertChecks(task, context);
    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns all violations at once', () => {
    const task = makeTask({
      headcount: 5,
      assignees: ['emp1'],
      date: '2025-06-15',
    });
    const context = makeContext({
      customerLicenses: ['PEST_CONTROL'],
      employees: [makeEmployee('emp1', { designatedLeaves: ['2025-06-15'] })],
    });
    const result = runAlertChecks(task, context);
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });
});

import fc from 'fast-check';
import type { LicenseType } from '@/types/alert';

/**
 * Property 13: 證照要求規則
 * Validates: Requirements 7.1
 *
 * For any task with customer license requirements and any set of assigned employees,
 * a violation is produced IFF no single employee holds ALL required licenses.
 */
describe('Property 13: 證照要求規則 (License Required Rule)', () => {
  const ALL_LICENSES: LicenseType[] = [
    'PROFESSIONAL',
    'PEST_CONTROL',
    'FIRE_ANT',
    'SAFETY_6HR',
    'SAFETY_MANAGER_A',
    'SAFETY_MANAGER_B',
    'SAFETY_MANAGER_C',
  ];

  // Generator for a non-empty subset of meaningful licenses (excluding 'NONE')
  const arbRequiredLicenses = fc
    .subarray(ALL_LICENSES, { minLength: 1, maxLength: ALL_LICENSES.length })
    .filter((arr) => arr.length > 0);

  // Generator for an employee's license set (any subset of all licenses, possibly including 'NONE')
  const arbEmployeeLicenses: fc.Arbitrary<LicenseType[]> = fc.subarray(
    ['NONE', ...ALL_LICENSES] as LicenseType[],
    { minLength: 0, maxLength: ALL_LICENSES.length + 1 },
  );

  // Generator for a non-empty list of employees with arbitrary licenses
  const arbEmployees = fc
    .array(arbEmployeeLicenses, { minLength: 1, maxLength: 10 })
    .map((licenseSets) =>
      licenseSets.map((licenses, idx) =>
        makeEmployee(`emp${idx}`, { licenses: licenses.length > 0 ? licenses : ['NONE'] }),
      ),
    );

  it('should produce violation IFF no employee holds all required licenses', () => {
    fc.assert(
      fc.property(arbRequiredLicenses, arbEmployees, (requiredLicenses, employees) => {
        const assigneeIds = employees.map((e) => e.id);
        const task = makeTask({ assignees: assigneeIds });
        const context = makeContext({
          customerLicenses: requiredLicenses,
          employees,
        });

        const result = checkLicenseRequired(task, context);

        // Determine if any employee holds ALL required licenses
        const someoneQualified = employees.some((emp) =>
          requiredLicenses.every((lic) => emp.licenses.includes(lic)),
        );

        if (someoneQualified) {
          // No violation expected
          expect(result).toBeNull();
        } else {
          // Violation expected
          expect(result).not.toBeNull();
          expect(result?.ruleId).toBe('LICENSE_REQUIRED');
          expect(result?.severity).toBe('BLOCKING');
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 7.1**
   */
  it('should return null when customerLicenses is empty or only contains NONE', () => {
    fc.assert(
      fc.property(
        arbEmployees,
        fc.constantFrom([], ['NONE'] as LicenseType[]),
        (employees, customerLicenses) => {
          const assigneeIds = employees.map((e) => e.id);
          const task = makeTask({ assignees: assigneeIds });
          const context = makeContext({
            customerLicenses,
            employees,
          });

          const result = checkLicenseRequired(task, context);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.1**
   */
  it('should produce violation when all employees have disjoint subsets of required licenses', () => {
    fc.assert(
      fc.property(
        fc.subarray(ALL_LICENSES, { minLength: 2, maxLength: ALL_LICENSES.length }),
        (requiredLicenses) => {
          // Create employees where each holds only one of the required licenses
          // so no single person holds ALL
          const employees = requiredLicenses.map((lic, idx) =>
            makeEmployee(`emp${idx}`, { licenses: [lic] }),
          );

          const assigneeIds = employees.map((e) => e.id);
          const task = makeTask({ assignees: assigneeIds });
          const context = makeContext({
            customerLicenses: requiredLicenses,
            employees,
          });

          const result = checkLicenseRequired(task, context);

          // Since each employee has only 1 license and we require >= 2,
          // no single employee can hold all required licenses
          expect(result).not.toBeNull();
          expect(result?.ruleId).toBe('LICENSE_REQUIRED');
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 14: 連續工作日規則
 * **Validates: Requirements 7.2**
 *
 * For any set of existing task dates for an employee and a new task date,
 * checkConsecutiveDays produces a violation IFF adding the new date creates
 * a consecutive working run > 7 days.
 */
describe('Property 14: 連續工作日規則 (Consecutive Days Rule)', () => {
  // Helper: independently compute max consecutive days from a set of date strings
  const computeMaxConsecutive = (dates: string[]): number => {
    if (dates.length === 0) return 0;
    const unique = [...new Set(dates)].sort();
    if (unique.length === 0) return 0;

    let maxConsecutive = 1;
    let current = 1;

    for (let i = 1; i < unique.length; i++) {
      const prev = new Date(unique[i - 1]!);
      const curr = new Date(unique[i]!);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else if (diffDays > 1) {
        current = 1;
      }
      // diffDays === 0: same day, skip
    }

    return maxConsecutive;
  };

  // Generator for a date string in YYYY-MM-DD format within a reasonable range
  const arbDate = fc.integer({ min: 0, max: 59 }).map((offset) => {
    const base = new Date('2025-06-01');
    base.setDate(base.getDate() + offset);
    return base.toISOString().slice(0, 10);
  });

  // Generator for a set of existing task dates (0 to 20 dates)
  const arbExistingDates = fc.array(arbDate, { minLength: 0, maxLength: 20 });

  it('should produce violation IFF consecutive working days > 7 after adding new date', () => {
    fc.assert(
      fc.property(arbExistingDates, arbDate, (existingDates, newDate) => {
        // Build all dates including the new one
        const allDates = [...new Set([...existingDates, newDate])];

        // Independently compute max consecutive days
        const maxConsecutive = computeMaxConsecutive(allDates);
        const shouldViolate = maxConsecutive > 7;

        // Set up the check using a single employee
        const empId = 'emp-test';
        const task = makeTask({ date: newDate, assignees: [empId] });

        const existingTasks = existingDates.map((date, idx) =>
          makeExistingTask({
            id: `existing-${idx}`,
            date,
            assignees: [{ employeeId: empId, employeeName: 'Test', licenses: ['NONE'] }],
          }),
        );

        const context = makeContext({
          employees: [makeEmployee(empId)],
          existingTasks,
        });

        const result = checkConsecutiveDays(task, context);

        if (shouldViolate) {
          expect(result).not.toBeNull();
          expect(result?.ruleId).toBe('CONSECUTIVE_DAYS');
          expect(result?.severity).toBe('BLOCKING');
          expect(result?.affectedEmployees).toContain(empId);
        } else {
          expect(result).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should return null when employee has no existing tasks (max consecutive = 1)', () => {
    fc.assert(
      fc.property(arbDate, (newDate) => {
        const empId = 'emp-solo';
        const task = makeTask({ date: newDate, assignees: [empId] });
        const context = makeContext({
          employees: [makeEmployee(empId)],
          existingTasks: [],
        });

        const result = checkConsecutiveDays(task, context);
        // A single day means max consecutive = 1, which is <= 7
        expect(result).toBeNull();
      }),
      { numRuns: 50 },
    );
  });

  it('should produce violation when exactly 8 consecutive days exist', () => {
    fc.assert(
      fc.property(
        // Generate a start offset so we can build 7 existing + 1 new = 8 consecutive
        fc.integer({ min: 0, max: 30 }),
        (startOffset) => {
          const empId = 'emp-eight';
          const base = new Date('2025-06-01');
          base.setDate(base.getDate() + startOffset);

          // 7 existing dates forming consecutive days
          const existingDates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base);
            d.setDate(d.getDate() + i);
            return d.toISOString().slice(0, 10);
          });

          // New task date is the 8th consecutive day
          const newDateObj = new Date(base);
          newDateObj.setDate(newDateObj.getDate() + 7);
          const newDate = newDateObj.toISOString().slice(0, 10);

          const task = makeTask({ date: newDate, assignees: [empId] });
          const existingTasks = existingDates.map((date, idx) =>
            makeExistingTask({
              id: `t-${idx}`,
              date,
              assignees: [{ employeeId: empId, employeeName: 'Test', licenses: ['NONE'] }],
            }),
          );

          const context = makeContext({
            employees: [makeEmployee(empId)],
            existingTasks,
          });

          const result = checkConsecutiveDays(task, context);
          // 8 consecutive days > 7, should produce violation
          expect(result).not.toBeNull();
          expect(result?.ruleId).toBe('CONSECUTIVE_DAYS');
        },
      ),
      { numRuns: 30 },
    );
  });
});

/**
 * Property 15: 每日工時規則
 * **Validates: Requirements 7.3**
 *
 * For any set of same-day task time slots (existing + new) for an employee,
 * checkDailyHoursExceeded produces a violation IFF total hours > 10.
 */
describe('Property 15: 每日工時規則 (Daily Hours Exceeded Rule)', () => {
  // Generate a time as {hour, minute} where endTime > startTime (same-day only)
  // We represent time slots as [startMinutes, endMinutes] where end > start
  // Minutes range: 0 (00:00) to 1439 (23:59)

  // Helper to convert minutes from midnight to HH:mm string
  const minutesToTimeStr = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Helper to calculate duration in hours for a same-day slot (end > start)
  const slotDurationHours = (startMin: number, endMin: number): number => {
    return (endMin - startMin) / 60;
  };

  // Helper to calculate duration in minutes (exact integer) for a same-day slot
  const slotDurationMinutes = (startMin: number, endMin: number): number => {
    return endMin - startMin;
  };

  // Generator for a single non-overnight time slot: [startMinutes, endMinutes] where end > start
  // Minimum duration: 30 minutes (realistic)
  const arbTimeSlot = fc.integer({ min: 0, max: 1380 }).chain((start) =>
    fc.integer({ min: start + 30, max: Math.min(start + 600, 1439) }).map((end) => ({
      startMin: start,
      endMin: end,
    })),
  );

  // Generator for a list of 0..5 existing task time slots (non-overlapping not required for hours check)
  const arbExistingSlots = fc.array(arbTimeSlot, { minLength: 0, maxLength: 5 });

  it('should produce violation IFF total hours of all same-day tasks > 10', () => {
    fc.assert(
      fc.property(
        arbTimeSlot, // new task time slot
        arbExistingSlots, // existing tasks for the same employee on the same day
        (newSlot, existingSlots) => {
          const empId = 'emp-hours-test';
          const testDate = '2025-07-01';

          // Calculate total duration independently using integer minutes to
          // avoid floating-point precision drift near the 10-hour boundary.
          const newTaskMinutes = slotDurationMinutes(newSlot.startMin, newSlot.endMin);
          const existingMinutes = existingSlots.reduce(
            (sum, slot) => sum + slotDurationMinutes(slot.startMin, slot.endMin),
            0,
          );
          const totalMinutes = newTaskMinutes + existingMinutes;
          const shouldViolate = totalMinutes > 600;

          // Build task and context
          const task = makeTask({
            date: testDate,
            startTime: minutesToTimeStr(newSlot.startMin),
            endTime: minutesToTimeStr(newSlot.endMin),
            assignees: [empId],
          });

          const existingTasks = existingSlots.map((slot, idx) =>
            makeExistingTask({
              id: `existing-${idx}`,
              date: testDate,
              startTime: minutesToTimeStr(slot.startMin),
              endTime: minutesToTimeStr(slot.endMin),
              assignees: [{ employeeId: empId, employeeName: 'Test', licenses: ['NONE'] }],
            }),
          );

          const context = makeContext({
            employees: [makeEmployee(empId)],
            existingTasks,
          });

          const result = checkDailyHoursExceeded(task, context);

          if (shouldViolate) {
            expect(result).not.toBeNull();
            expect(result?.ruleId).toBe('DAILY_HOURS_EXCEEDED');
            expect(result?.severity).toBe('BLOCKING');
            expect(result?.affectedEmployees).toContain(empId);
          } else {
            expect(result).toBeNull();
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should return null when employee has no existing tasks and new task <= 10 hours', () => {
    // Generate slots with duration at most 10 hours (600 minutes)
    const arbShortSlot = fc.integer({ min: 0, max: 839 }).chain((start) =>
      fc.integer({ min: start + 30, max: Math.min(start + 600, 1439) }).map((end) => ({
        startMin: start,
        endMin: end,
      })),
    );

    fc.assert(
      fc.property(arbShortSlot, (slot) => {
        const empId = 'emp-no-existing';
        const testDate = '2025-07-02';
        const hours = slotDurationHours(slot.startMin, slot.endMin);

        // Only test cases where duration <= 10 hours
        fc.pre(hours <= 10);

        const task = makeTask({
          date: testDate,
          startTime: minutesToTimeStr(slot.startMin),
          endTime: minutesToTimeStr(slot.endMin),
          assignees: [empId],
        });

        const context = makeContext({
          employees: [makeEmployee(empId)],
          existingTasks: [],
        });

        const result = checkDailyHoursExceeded(task, context);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('should produce violation when total hours are just over 10 (boundary)', () => {
    fc.assert(
      fc.property(
        // Generate an existing slot duration in minutes (between 300 and 599, i.e. 5-~10 hours)
        fc.integer({ min: 300, max: 599 }),
        (existingDurationMin) => {
          const empId = 'emp-boundary';
          const testDate = '2025-07-03';

          // Existing task: starts at 06:00 with the generated duration
          const existingStart = 360; // 06:00
          const existingEnd = existingStart + existingDurationMin;
          fc.pre(existingEnd <= 1439); // must fit in a day

          // New task: make total just exceed 10 hours
          // We need new duration > (600 - existingDurationMin) minutes to exceed 10 hours total
          const newDurationMin = 601 - existingDurationMin; // just over the threshold
          fc.pre(newDurationMin >= 30); // minimum duration
          const newStart = existingEnd + 1; // start after existing (no overlap needed for this rule)
          const newEnd = newStart + newDurationMin;
          fc.pre(newEnd <= 1439); // must fit in a day

          const task = makeTask({
            date: testDate,
            startTime: minutesToTimeStr(newStart),
            endTime: minutesToTimeStr(newEnd),
            assignees: [empId],
          });

          const existingTasks = [
            makeExistingTask({
              id: 'existing-boundary',
              date: testDate,
              startTime: minutesToTimeStr(existingStart),
              endTime: minutesToTimeStr(existingEnd),
              assignees: [{ employeeId: empId, employeeName: 'Test', licenses: ['NONE'] }],
            }),
          ];

          const context = makeContext({
            employees: [makeEmployee(empId)],
            existingTasks,
          });

          // Verify total exceeds 10
          const totalHours = (existingDurationMin + newDurationMin) / 60;
          expect(totalHours).toBeGreaterThan(10);

          const result = checkDailyHoursExceeded(task, context);
          expect(result).not.toBeNull();
          expect(result?.ruleId).toBe('DAILY_HOURS_EXCEEDED');
        },
      ),
      { numRuns: 100 },
    );
  });
});

import { isTimeOverlap } from './date';

/**
 * Property 16: 時間重疊偵測
 * **Validates: Requirements 7.4**
 *
 * For any two time intervals [s1, e1] and [s2, e2] (in minutes from midnight),
 * isTimeOverlap returns true IFF s1 < e2 AND s2 < e1 (i.e., intervals are non-disjoint).
 * Also verifies commutativity: isTimeOverlap(s1,e1,s2,e2) === isTimeOverlap(s2,e2,s1,e1).
 */
describe('Property 16: 時間重疊偵測 (Time Overlap Detection)', () => {
  // Generator for a valid time interval [start, end] in minutes from midnight
  // where end > start (valid same-day interval: 0-1439)
  const arbTimeInterval = fc
    .integer({ min: 0, max: 1438 })
    .chain((start) => fc.integer({ min: start + 1, max: 1439 }).map((end) => ({ start, end })));

  it('should return true IFF s1 < e2 AND s2 < e1 for any two intervals', () => {
    fc.assert(
      fc.property(arbTimeInterval, arbTimeInterval, (interval1, interval2) => {
        const { start: s1, end: e1 } = interval1;
        const { start: s2, end: e2 } = interval2;

        const result = isTimeOverlap(s1, e1, s2, e2);

        // Expected overlap condition: s1 < e2 AND s2 < e1
        const expectedOverlap = s1 < e2 && s2 < e1;

        expect(result).toBe(expectedOverlap);
      }),
      { numRuns: 500 },
    );
  });

  it('should be commutative: overlap(s1,e1,s2,e2) === overlap(s2,e2,s1,e1)', () => {
    fc.assert(
      fc.property(arbTimeInterval, arbTimeInterval, (interval1, interval2) => {
        const { start: s1, end: e1 } = interval1;
        const { start: s2, end: e2 } = interval2;

        const result1 = isTimeOverlap(s1, e1, s2, e2);
        const result2 = isTimeOverlap(s2, e2, s1, e1);

        expect(result1).toBe(result2);
      }),
      { numRuns: 300 },
    );
  });

  it('should detect overlap when one interval contains another', () => {
    fc.assert(
      fc.property(
        // Generate an outer interval and an inner interval contained within it
        fc.integer({ min: 0, max: 1000 }).chain((outerStart) =>
          fc
            .integer({ min: outerStart + 3, max: Math.min(outerStart + 500, 1439) })
            .chain((outerEnd) =>
              fc.integer({ min: outerStart + 1, max: outerEnd - 1 }).chain((innerStart) =>
                fc.integer({ min: innerStart + 1, max: outerEnd }).map((innerEnd) => ({
                  outer: { start: outerStart, end: outerEnd },
                  inner: { start: innerStart, end: innerEnd },
                })),
              ),
            ),
        ),
        ({ outer, inner }) => {
          // When one interval contains another, they must overlap
          const result = isTimeOverlap(outer.start, outer.end, inner.start, inner.end);
          expect(result).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should detect no overlap when intervals are disjoint', () => {
    fc.assert(
      fc.property(
        // Generate two disjoint intervals: interval1 ends before interval2 starts
        fc.integer({ min: 0, max: 1436 }).chain((s1) =>
          fc.integer({ min: s1 + 1, max: Math.min(s1 + 500, 1437) }).chain((e1) =>
            fc.integer({ min: e1, max: 1438 }).chain((s2) =>
              fc.integer({ min: s2 + 1, max: 1439 }).map((e2) => ({
                s1,
                e1,
                s2,
                e2,
              })),
            ),
          ),
        ),
        ({ s1, e1, s2, e2 }) => {
          // When e1 <= s2, intervals are disjoint (no overlap)
          const result = isTimeOverlap(s1, e1, s2, e2);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 17: 指定休假規則
 * **Validates: Requirements 7.5**
 *
 * For any employee's designated leave date set and a task date,
 * checkDesignatedLeave produces a violation IFF the task date is in the employee's designated leave set.
 */
describe('Property 17: 指定休假規則 (Designated Leave Rule)', () => {
  // Generator for a date string in YYYY-MM-DD format within a reasonable range
  const arbDate = fc.integer({ min: 0, max: 89 }).map((offset) => {
    const base = new Date('2025-06-01');
    base.setDate(base.getDate() + offset);
    return base.toISOString().slice(0, 10);
  });

  // Generator for a set of designated leave dates (0 to 15 dates)
  const arbLeaveDates = fc.array(arbDate, { minLength: 0, maxLength: 15 }).map(
    (dates) => [...new Set(dates)], // ensure uniqueness
  );

  it('should produce violation IFF task date is in employee designated leave set', () => {
    fc.assert(
      fc.property(arbLeaveDates, arbDate, (leaveDates, taskDate) => {
        const empId = 'emp-leave-test';
        const task = makeTask({ date: taskDate, assignees: [empId] });
        const context = makeContext({
          employees: [makeEmployee(empId, { designatedLeaves: leaveDates })],
        });

        const result = checkDesignatedLeave(task, context);

        // Independently determine if violation should occur
        const shouldViolate = leaveDates.includes(taskDate);

        if (shouldViolate) {
          expect(result).not.toBeNull();
          expect(result?.ruleId).toBe('DESIGNATED_LEAVE');
          expect(result?.severity).toBe('BLOCKING');
          expect(result?.affectedEmployees).toContain(empId);
        } else {
          expect(result).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should return null when employee has no designated leaves', () => {
    fc.assert(
      fc.property(arbDate, (taskDate) => {
        const empId = 'emp-no-leave';
        const task = makeTask({ date: taskDate, assignees: [empId] });
        const context = makeContext({
          employees: [makeEmployee(empId, { designatedLeaves: [] })],
        });

        const result = checkDesignatedLeave(task, context);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('should detect violation for multiple employees independently', () => {
    fc.assert(
      fc.property(arbLeaveDates, arbLeaveDates, arbDate, (leaveDates1, leaveDates2, taskDate) => {
        const emp1Id = 'emp-multi-1';
        const emp2Id = 'emp-multi-2';

        const task = makeTask({ date: taskDate, assignees: [emp1Id, emp2Id] });
        const context = makeContext({
          employees: [
            makeEmployee(emp1Id, { designatedLeaves: leaveDates1 }),
            makeEmployee(emp2Id, { designatedLeaves: leaveDates2 }),
          ],
        });

        const result = checkDesignatedLeave(task, context);

        const emp1OnLeave = leaveDates1.includes(taskDate);
        const emp2OnLeave = leaveDates2.includes(taskDate);
        const anyOnLeave = emp1OnLeave || emp2OnLeave;

        if (anyOnLeave) {
          expect(result).not.toBeNull();
          expect(result?.ruleId).toBe('DESIGNATED_LEAVE');
          if (emp1OnLeave) {
            expect(result?.affectedEmployees).toContain(emp1Id);
          }
          if (emp2OnLeave) {
            expect(result?.affectedEmployees).toContain(emp2Id);
          }
        } else {
          expect(result).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 18: 人數需求規則
 * **Validates: Requirements 7.6**
 *
 * For any minimum headcount requirement and any number of assigned employees,
 * checkHeadcountBelowMin produces a violation IFF assignees.length < headcount.
 */
describe('Property 18: 人數需求規則 (Headcount Below Minimum Rule)', () => {
  // Generator for headcount requirement (1 to 20)
  const arbHeadcount = fc.integer({ min: 1, max: 20 });

  // Generator for a list of assignee IDs (0 to 20 employees)
  const arbAssignees = fc
    .integer({ min: 0, max: 20 })
    .map((count) => Array.from({ length: count }, (_, i) => `emp${i + 1}`));

  it('should produce violation IFF assignees.length < headcount', () => {
    fc.assert(
      fc.property(arbHeadcount, arbAssignees, (headcount, assignees) => {
        const task = makeTask({ headcount, assignees });
        const context = makeContext();

        const result = checkHeadcountBelowMin(task, context);

        // Independently determine if violation should occur
        const shouldViolate = assignees.length < headcount;

        if (shouldViolate) {
          expect(result).not.toBeNull();
          expect(result?.ruleId).toBe('HEADCOUNT_BELOW_MIN');
          expect(result?.severity).toBe('BLOCKING');
          expect(result?.details).toEqual({ required: headcount, actual: assignees.length });
        } else {
          expect(result).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });

  it('should return null when assignees exactly meet headcount', () => {
    fc.assert(
      fc.property(arbHeadcount, (headcount) => {
        // Generate exactly as many assignees as headcount
        const assignees = Array.from({ length: headcount }, (_, i) => `emp${i + 1}`);
        const task = makeTask({ headcount, assignees });
        const context = makeContext();

        const result = checkHeadcountBelowMin(task, context);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('should return null when assignees exceed headcount', () => {
    fc.assert(
      fc.property(arbHeadcount, fc.integer({ min: 1, max: 10 }), (headcount, extra) => {
        // Generate more assignees than headcount
        const assignees = Array.from({ length: headcount + extra }, (_, i) => `emp${i + 1}`);
        const task = makeTask({ headcount, assignees });
        const context = makeContext();

        const result = checkHeadcountBelowMin(task, context);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 9: 警示驗證閘門
 * **Validates: Requirements 3.8, 7.7**
 *
 * For any task form data, task save succeeds IFF (no violations OR override remark provided).
 * - If runAlertChecks returns isValid === true → save allowed (no override needed)
 * - If runAlertChecks returns isValid === false AND no override remark → save blocked
 * - If runAlertChecks returns isValid === false AND override remark provided → save allowed, status = OVERRIDDEN
 */
describe('Property 9: 警示驗證閘門 (Alert Validation Gate)', () => {
  const ALL_LICENSES: LicenseType[] = [
    'PROFESSIONAL',
    'PEST_CONTROL',
    'FIRE_ANT',
    'SAFETY_6HR',
    'SAFETY_MANAGER_A',
    'SAFETY_MANAGER_B',
    'SAFETY_MANAGER_C',
  ];

  /**
   * The "alert validation gate" logic as implemented in TaskForm save flow:
   * - Run runAlertChecks to get AlertValidationResult
   * - If isValid → save proceeds, alertStatus = 'CLEAN'
   * - If !isValid and no overrideRemark → save is BLOCKED
   * - If !isValid and overrideRemark is provided → save proceeds, alertStatus = 'OVERRIDDEN'
   *
   * Returns: { canSave: boolean, alertStatus: 'CLEAN' | 'VIOLATED' | 'OVERRIDDEN' }
   */
  const alertValidationGate = (
    validationResult: { isValid: boolean; violations: unknown[] },
    overrideRemark: string | undefined,
  ): { canSave: boolean; alertStatus: 'CLEAN' | 'VIOLATED' | 'OVERRIDDEN' } => {
    if (validationResult.isValid) {
      return { canSave: true, alertStatus: 'CLEAN' };
    }
    // Has violations
    if (overrideRemark && overrideRemark.trim().length > 0) {
      return { canSave: true, alertStatus: 'OVERRIDDEN' };
    }
    return { canSave: false, alertStatus: 'VIOLATED' };
  };

  // Generator for employee IDs (1 to 5 employees)
  const arbEmployeeIds = fc
    .integer({ min: 1, max: 5 })
    .map((count) => Array.from({ length: count }, (_, i) => `emp${i + 1}`));

  // Generator for headcount (1 to 10)
  const arbHeadcount = fc.integer({ min: 1, max: 10 });

  // Generator for a time string HH:mm
  const arbTimeStr = fc
    .integer({ min: 0, max: 23 })
    .chain((h) =>
      fc
        .integer({ min: 0, max: 59 })
        .map((m) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`),
    );

  // Generator for a date string
  const arbDate = fc
    .integer({ min: 1, max: 28 })
    .map((d) => `2025-07-${d.toString().padStart(2, '0')}`);

  // Generator for customer licenses (may or may not have requirements)
  const arbCustomerLicenses = fc.oneof(
    fc.constant([] as LicenseType[]),
    fc.subarray(ALL_LICENSES, { minLength: 1, maxLength: 3 }),
  );

  // Generator for designated leaves (array of date strings)
  const arbDesignatedLeaves = fc.array(
    fc.integer({ min: 1, max: 28 }).map((d) => `2025-07-${d.toString().padStart(2, '0')}`),
    { minLength: 0, maxLength: 5 },
  );

  // Generator for an override remark (either undefined/empty or a non-empty string)
  const arbOverrideRemark = fc.oneof(
    fc.constant(undefined as string | undefined),
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  );

  it('save succeeds IFF (no violations OR override remark provided)', () => {
    fc.assert(
      fc.property(
        arbEmployeeIds,
        arbHeadcount,
        arbDate,
        arbTimeStr,
        arbTimeStr,
        arbCustomerLicenses,
        arbDesignatedLeaves,
        arbOverrideRemark,
        (
          assigneeIds,
          headcount,
          date,
          startTime,
          endTime,
          customerLicenses,
          designatedLeaves,
          overrideRemark,
        ) => {
          // Build employees with random licenses
          const employees = assigneeIds.map((id) =>
            makeEmployee(id, {
              designatedLeaves,
              licenses: ALL_LICENSES.slice(0, Math.floor(Math.random() * ALL_LICENSES.length)),
            }),
          );

          const task = makeTask({
            assignees: assigneeIds,
            headcount,
            date,
            startTime,
            endTime,
          });

          const context = makeContext({
            employees,
            customerLicenses,
            existingTasks: [],
          });

          // Run the alert engine
          const validationResult = runAlertChecks(task, context);

          // Apply the gate logic
          const gateResult = alertValidationGate(validationResult, overrideRemark);

          // Core property: save succeeds iff (no violations OR valid override remark)
          const hasValidOverride = overrideRemark !== undefined && overrideRemark.trim().length > 0;
          const expectedCanSave = validationResult.isValid || hasValidOverride;

          expect(gateResult.canSave).toBe(expectedCanSave);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('isValid === true implies no violations and save always succeeds (regardless of override)', () => {
    fc.assert(
      fc.property(arbEmployeeIds, arbOverrideRemark, (assigneeIds, overrideRemark) => {
        // Construct a scenario guaranteed to have NO violations:
        // - headcount <= assignees.length (no HEADCOUNT_BELOW_MIN)
        // - no customer licenses (no LICENSE_REQUIRED)
        // - no designated leaves on task date (no DESIGNATED_LEAVE)
        // - no existing tasks (no CONSECUTIVE_DAYS, DAILY_HOURS_EXCEEDED, DUPLICATE_SLOT)
        const task = makeTask({
          assignees: assigneeIds,
          headcount: assigneeIds.length, // exactly meets headcount
          date: '2025-08-01',
          startTime: '09:00',
          endTime: '12:00',
        });

        const employees = assigneeIds.map((id) =>
          makeEmployee(id, { designatedLeaves: [], licenses: ['NONE'] }),
        );

        const context = makeContext({
          employees,
          customerLicenses: [],
          existingTasks: [],
        });

        const validationResult = runAlertChecks(task, context);

        // Should be valid with no violations
        expect(validationResult.isValid).toBe(true);
        expect(validationResult.violations).toHaveLength(0);

        // Gate should always allow save
        const gateResult = alertValidationGate(validationResult, overrideRemark);
        expect(gateResult.canSave).toBe(true);
        expect(gateResult.alertStatus).toBe('CLEAN');
      }),
      { numRuns: 100 },
    );
  });

  it('violations without override remark always blocks save', () => {
    fc.assert(
      fc.property(
        // Use at least 1 assignee but headcount > assignees to guarantee a violation
        fc.integer({ min: 1, max: 5 }),
        (assigneeCount) => {
          const assigneeIds = Array.from({ length: assigneeCount }, (_, i) => `emp${i + 1}`);
          // headcount is always greater than assignees → guaranteed HEADCOUNT_BELOW_MIN violation
          const task = makeTask({
            assignees: assigneeIds,
            headcount: assigneeCount + 1,
            date: '2025-08-01',
            startTime: '09:00',
            endTime: '12:00',
          });

          const employees = assigneeIds.map((id) =>
            makeEmployee(id, { designatedLeaves: [], licenses: ['NONE'] }),
          );

          const context = makeContext({
            employees,
            customerLicenses: [],
            existingTasks: [],
          });

          const validationResult = runAlertChecks(task, context);

          // Should have violations
          expect(validationResult.isValid).toBe(false);
          expect(validationResult.violations.length).toBeGreaterThan(0);

          // Without override remark → save blocked
          const noOverride = alertValidationGate(validationResult, undefined);
          expect(noOverride.canSave).toBe(false);
          expect(noOverride.alertStatus).toBe('VIOLATED');

          // With empty string override → save blocked
          const emptyOverride = alertValidationGate(validationResult, '');
          expect(emptyOverride.canSave).toBe(false);
          expect(emptyOverride.alertStatus).toBe('VIOLATED');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('violations with valid override remark allows save and marks as OVERRIDDEN', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (assigneeCount, overrideRemark) => {
          const assigneeIds = Array.from({ length: assigneeCount }, (_, i) => `emp${i + 1}`);
          // Guarantee violation via headcount mismatch
          const task = makeTask({
            assignees: assigneeIds,
            headcount: assigneeCount + 1,
            date: '2025-08-01',
            startTime: '09:00',
            endTime: '12:00',
          });

          const employees = assigneeIds.map((id) =>
            makeEmployee(id, { designatedLeaves: [], licenses: ['NONE'] }),
          );

          const context = makeContext({
            employees,
            customerLicenses: [],
            existingTasks: [],
          });

          const validationResult = runAlertChecks(task, context);

          // Should have violations
          expect(validationResult.isValid).toBe(false);

          // With valid override remark → save allowed, status OVERRIDDEN
          const gateResult = alertValidationGate(validationResult, overrideRemark);
          expect(gateResult.canSave).toBe(true);
          expect(gateResult.alertStatus).toBe('OVERRIDDEN');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isValid correlates with violations: isValid === true iff violations.length === 0', () => {
    fc.assert(
      fc.property(
        arbEmployeeIds,
        arbHeadcount,
        arbDate,
        arbTimeStr,
        arbTimeStr,
        arbCustomerLicenses,
        arbDesignatedLeaves,
        (assigneeIds, headcount, date, startTime, endTime, customerLicenses, designatedLeaves) => {
          const employees = assigneeIds.map((id) =>
            makeEmployee(id, {
              designatedLeaves,
              licenses: ALL_LICENSES.slice(0, Math.floor(Math.random() * ALL_LICENSES.length)),
            }),
          );

          const task = makeTask({
            assignees: assigneeIds,
            headcount,
            date,
            startTime,
            endTime,
          });

          const context = makeContext({
            employees,
            customerLicenses,
            existingTasks: [],
          });

          const result = runAlertChecks(task, context);

          // Core invariant: isValid iff no violations
          expect(result.isValid).toBe(result.violations.length === 0);
        },
      ),
      { numRuns: 200 },
    );
  });
});
