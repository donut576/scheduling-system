import type { TaskFormData, TaskAssignee } from '@/types/task';
import type {
  AlertViolation,
  AlertValidationResult,
  AlertContext,
  AlertRuleChecker,
} from '@/types/alert';
import { calculateDurationMinutes, getMaxConsecutiveDays, isTimeStringOverlap } from './date';

/**
 * Rule 1: License Required
 * At least one assigned employee must hold all customer-required licenses
 */
export const checkLicenseRequired: AlertRuleChecker = (task, context) => {
  const { customerLicenses, employees } = context;
  if (customerLicenses.length === 0 || customerLicenses.every((l) => l === 'NONE')) return null;

  const requiredLicenses = customerLicenses.filter((l) => l !== 'NONE');
  if (requiredLicenses.length === 0) return null;

  const assignedEmployees = employees.filter((e) => task.assignees.includes(e.id));
  const hasQualified = assignedEmployees.some((emp) =>
    requiredLicenses.every((lic) => emp.licenses.includes(lic)),
  );

  if (!hasQualified) {
    return {
      ruleId: 'LICENSE_REQUIRED',
      severity: 'BLOCKING',
      message: '指派員工中無人持有客戶要求之證照',
      details: { required: requiredLicenses },
      affectedEmployees: task.assignees,
    };
  }
  return null;
};

/**
 * Rule 2: Consecutive Days
 * Employee should not work more than 7 consecutive days
 */
export const checkConsecutiveDays: AlertRuleChecker = (task, context) => {
  const violations: string[] = [];

  for (const empId of task.assignees) {
    const empTaskDates = context.existingTasks
      .filter((t) => t.assignees.some((a: TaskAssignee) => a.employeeId === empId))
      .map((t) => t.date);

    const maxDays = getMaxConsecutiveDays(empTaskDates, task.date);
    if (maxDays > 7) {
      violations.push(empId);
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: 'CONSECUTIVE_DAYS',
      severity: 'BLOCKING',
      message: '指派員工連續工作超過七日',
      details: { maxAllowed: 7 },
      affectedEmployees: violations,
    };
  }
  return null;
};

/**
 * Rule 3: Daily Hours Exceeded
 * Employee should not work more than 10 hours in a single day
 */
export const checkDailyHoursExceeded: AlertRuleChecker = (task, context) => {
  const violations: string[] = [];

  for (const empId of task.assignees) {
    const sameDayTasks = context.existingTasks.filter(
      (t) => t.date === task.date && t.assignees.some((a: TaskAssignee) => a.employeeId === empId),
    );

    // Calculate total minutes including the new task.
    // Summing integer minutes (rather than float hours) avoids floating-point
    // precision drift near the 10-hour (600-minute) boundary.
    let totalMinutes = calculateDurationMinutes(task.startTime, task.endTime);
    for (const existingTask of sameDayTasks) {
      totalMinutes += calculateDurationMinutes(existingTask.startTime, existingTask.endTime);
    }

    if (totalMinutes > 600) {
      violations.push(empId);
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: 'DAILY_HOURS_EXCEEDED',
      severity: 'BLOCKING',
      message: '指派員工當日工時超過十小時',
      details: { maxAllowed: 10 },
      affectedEmployees: violations,
    };
  }
  return null;
};

/**
 * Rule 4: Duplicate Slot
 * Employee should not be scheduled in overlapping time slots on the same day
 */
export const checkDuplicateSlot: AlertRuleChecker = (task, context) => {
  const violations: string[] = [];

  for (const empId of task.assignees) {
    const sameDayTasks = context.existingTasks.filter(
      (t) => t.date === task.date && t.assignees.some((a: TaskAssignee) => a.employeeId === empId),
    );

    const hasOverlap = sameDayTasks.some((existingTask) =>
      isTimeStringOverlap(
        task.startTime,
        task.endTime,
        existingTask.startTime,
        existingTask.endTime,
      ),
    );

    if (hasOverlap) {
      violations.push(empId);
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: 'DUPLICATE_SLOT',
      severity: 'BLOCKING',
      message: '指派員工於相同時段已有排班',
      details: {},
      affectedEmployees: violations,
    };
  }
  return null;
};

/**
 * Rule 5: Designated Leave
 * Employee should not be scheduled on their designated leave days
 */
export const checkDesignatedLeave: AlertRuleChecker = (task, context) => {
  const violations: string[] = [];

  for (const empId of task.assignees) {
    const emp = context.employees.find((e) => e.id === empId);
    if (emp && emp.designatedLeaves.includes(task.date)) {
      violations.push(empId);
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: 'DESIGNATED_LEAVE',
      severity: 'BLOCKING',
      message: '指派員工於指定休假日被排班',
      details: {},
      affectedEmployees: violations,
    };
  }
  return null;
};

/**
 * Rule 6: Headcount Below Minimum
 * Number of assigned employees should meet the required headcount
 */
export const checkHeadcountBelowMin: AlertRuleChecker = (task) => {
  if (task.assignees.length < task.headcount) {
    return {
      ruleId: 'HEADCOUNT_BELOW_MIN',
      severity: 'BLOCKING',
      message: '指派人數低於最低需求人數',
      details: { required: task.headcount, actual: task.assignees.length },
    };
  }
  return null;
};

/**
 * Main alert check runner - executes all 6 rules
 */
export const runAlertChecks = (
  task: TaskFormData,
  context: AlertContext,
): AlertValidationResult => {
  const checkers: AlertRuleChecker[] = [
    checkLicenseRequired,
    checkConsecutiveDays,
    checkDailyHoursExceeded,
    checkDuplicateSlot,
    checkDesignatedLeave,
    checkHeadcountBelowMin,
  ];

  const violations = checkers
    .map((checker) => checker(task, context))
    .filter((v): v is AlertViolation => v !== null);

  return {
    isValid: violations.length === 0,
    violations,
    canOverride: true, // Backend determines actual override permission
  };
};
