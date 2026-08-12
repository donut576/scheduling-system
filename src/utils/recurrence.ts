import type { RecurrenceRule } from '@/types/task';

/**
 * Maximum number of instances to generate when endType is 'never'.
 */
const MAX_NEVER_INSTANCES = 52;

/**
 * Maximum iterations to prevent infinite loops.
 */
const MAX_ITERATIONS = 10000;

/**
 * Generates recurrence instances based on a start date and a recurrence rule.
 * Returns an array of ISO date strings (YYYY-MM-DD).
 *
 * @param startDate - The first occurrence date in YYYY-MM-DD format
 * @param rule - The recurrence rule defining frequency, interval, and end condition
 * @returns Array of ISO date strings representing each occurrence
 */
export function generateRecurrenceInstances(startDate: string, rule: RecurrenceRule): string[] {
  const start = parseDate(startDate);
  if (isNaN(start.getTime())) return [];
  if (rule.interval < 1) return [];

  switch (rule.frequency) {
    case 'daily':
    case 'custom':
      return generateDaily(start, rule);
    case 'weekly':
      return rule.daysOfWeek && rule.daysOfWeek.length > 0
        ? generateWeeklyWithDays(start, rule)
        : generateWeeklySimple(start, rule);
    case 'monthly':
      return generateMonthly(start, rule);
    default:
      return [];
  }
}

/**
 * Generate instances for daily/custom frequency.
 * Each instance is exactly `interval` days after the previous one.
 */
function generateDaily(start: Date, rule: RecurrenceRule): string[] {
  const instances: string[] = [];
  const maxCount = getTargetCount(rule);
  const endDate = rule.endType === 'date' && rule.endDate ? parseDate(rule.endDate) : null;

  let current = new Date(start);

  for (let i = 0; i < maxCount; i++) {
    if (endDate && current > endDate) break;
    instances.push(formatDate(current));
    current = new Date(current);
    current.setDate(current.getDate() + rule.interval);
  }

  return instances;
}

/**
 * Generate instances for weekly frequency without specific daysOfWeek.
 * Each instance is exactly `interval * 7` days after the previous one.
 */
function generateWeeklySimple(start: Date, rule: RecurrenceRule): string[] {
  const instances: string[] = [];
  const maxCount = getTargetCount(rule);
  const endDate = rule.endType === 'date' && rule.endDate ? parseDate(rule.endDate) : null;

  let current = new Date(start);

  for (let i = 0; i < maxCount; i++) {
    if (endDate && current > endDate) break;
    instances.push(formatDate(current));
    current = new Date(current);
    current.setDate(current.getDate() + rule.interval * 7);
  }

  return instances;
}

/**
 * Generate instances for weekly frequency with specific daysOfWeek.
 * Instances fall on specified days of week, with `interval` weeks between each group.
 */
function generateWeeklyWithDays(start: Date, rule: RecurrenceRule): string[] {
  const instances: string[] = [];
  const maxCount = getTargetCount(rule);
  const endDate = rule.endType === 'date' && rule.endDate ? parseDate(rule.endDate) : null;
  const daysOfWeek = [...(rule.daysOfWeek ?? [])].sort((a, b) => a - b);

  // Find the start of the week containing the start date (Sunday = 0)
  const startDow = start.getDay();
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - startDow);

  const currentWeekStart = new Date(weekStart);
  let iterations = 0;

  while (instances.length < maxCount && iterations < MAX_ITERATIONS) {
    iterations++;

    for (const dow of daysOfWeek) {
      if (instances.length >= maxCount) break;

      const candidate = new Date(currentWeekStart);
      candidate.setDate(candidate.getDate() + dow);

      // Skip dates before start date
      if (candidate < start) continue;

      // Check end date
      if (endDate && candidate > endDate) return instances;

      instances.push(formatDate(candidate));
    }

    // Move to next interval week
    currentWeekStart.setDate(currentWeekStart.getDate() + rule.interval * 7);
  }

  return instances;
}

/**
 * Generate instances for monthly frequency.
 * Instances fall on the specified dayOfMonth (or same day as start if not specified),
 * spaced by `interval` months.
 */
function generateMonthly(start: Date, rule: RecurrenceRule): string[] {
  const instances: string[] = [];
  const maxCount = getTargetCount(rule);
  const endDate = rule.endType === 'date' && rule.endDate ? parseDate(rule.endDate) : null;
  const targetDay = rule.dayOfMonth ?? start.getDate();

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth();

  for (let i = 0; i < maxCount; i++) {
    const date = getMonthlyDate(currentYear, currentMonth, targetDay);

    if (endDate && date > endDate) break;

    instances.push(formatDate(date));

    // Advance by interval months
    currentMonth += rule.interval;
    while (currentMonth >= 12) {
      currentMonth -= 12;
      currentYear++;
    }
  }

  return instances;
}

/**
 * Get a date for a given year, month, and target day, clamping to the last day of month.
 */
function getMonthlyDate(year: number, month: number, targetDay: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(targetDay, lastDay);
  return new Date(year, month, day);
}

/**
 * Determines the target count of instances to generate.
 */
function getTargetCount(rule: RecurrenceRule): number {
  switch (rule.endType) {
    case 'count':
      return rule.endCount ?? MAX_NEVER_INSTANCES;
    case 'never':
      return MAX_NEVER_INSTANCES;
    case 'date':
      return MAX_ITERATIONS; // The date check in the loop will stop us
    default:
      return MAX_NEVER_INSTANCES;
  }
}

/**
 * Parses a YYYY-MM-DD date string into a Date object (local time).
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

/**
 * Formats a Date object to YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
