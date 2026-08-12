import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import isBetween from 'dayjs/plugin/isBetween';

// Configure Day.js plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.extend(isBetween);

const DEFAULT_TIMEZONE = 'Asia/Taipei';

/**
 * Format a date string to display format
 */
export const formatDate = (date: string | Date, format = 'YYYY-MM-DD'): string => {
  return dayjs(date).tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * Format a date string to ISO 8601 with timezone
 */
export const formatDateTime = (date: string | Date, format = 'YYYY-MM-DDTHH:mm:ssZ'): string => {
  return dayjs(date).tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * Format time string (HH:mm)
 */
export const formatTime = (time: string): string => {
  return time; // Already in HH:mm format
};

/**
 * Check if a task is overnight (end time <= start time means cross-day)
 */
export const isOvernight = (startTime: string, endTime: string): boolean => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMinutes = (sh ?? 0) * 60 + (sm ?? 0);
  const endMinutes = (eh ?? 0) * 60 + (em ?? 0);
  return endMinutes <= startMinutes;
};

/**
 * Calculate duration in minutes between start and end time
 * Handles overnight (cross-day) scenarios
 * Returns an exact integer, avoiding floating-point precision issues
 * that arise from dividing by 60.
 */
export const calculateDurationMinutes = (startTime: string, endTime: string): number => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMinutes = (sh ?? 0) * 60 + (sm ?? 0);
  const endMinutes = (eh ?? 0) * 60 + (em ?? 0);

  if (endMinutes <= startMinutes) {
    // Overnight: (24:00 - start) + end
    return 1440 - startMinutes + endMinutes;
  }
  return endMinutes - startMinutes;
};

/**
 * Calculate duration in hours between start and end time
 * Handles overnight (cross-day) scenarios
 */
export const calculateDuration = (startTime: string, endTime: string): number => {
  return calculateDurationMinutes(startTime, endTime) / 60;
};

/**
 * Check if two time intervals overlap
 * Intervals are in minutes from midnight (0-1439)
 */
export const isTimeOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): boolean => {
  return start1 < end2 && start2 < end1;
};

/**
 * Check if two time strings overlap (HH:mm format)
 * Handles overnight tasks
 */
export const isTimeStringOverlap = (
  startTime1: string,
  endTime1: string,
  startTime2: string,
  endTime2: string,
): boolean => {
  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const s1 = toMinutes(startTime1);
  const e1 = toMinutes(endTime1);
  const s2 = toMinutes(startTime2);
  const e2 = toMinutes(endTime2);

  // Handle overnight for both intervals
  const isOvernightInterval1 = e1 <= s1;
  const isOvernightInterval2 = e2 <= s2;

  if (!isOvernightInterval1 && !isOvernightInterval2) {
    // Both normal: standard overlap check
    return s1 < e2 && s2 < e1;
  }

  if (isOvernightInterval1 && !isOvernightInterval2) {
    // First is overnight: [s1, 1440) and [0, e1)
    return s2 < e1 || s1 < e2;
  }

  if (!isOvernightInterval1 && isOvernightInterval2) {
    // Second is overnight
    return s1 < e2 || s2 < e1;
  }

  // Both overnight - always overlap
  return true;
};

/**
 * Get max consecutive working days for an employee
 * given their existing task dates and a new task date
 */
export const getMaxConsecutiveDays = (existingDates: string[], newDate: string): number => {
  const allDates = [...new Set([...existingDates, newDate])].sort();
  if (allDates.length === 0) return 0;

  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < allDates.length; i++) {
    const prevDay = dayjs(allDates[i - 1]);
    const currDay = dayjs(allDates[i]);
    const diff = currDay.diff(prevDay, 'day');

    if (diff === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else if (diff > 1) {
      currentConsecutive = 1;
    }
    // diff === 0 means same day, skip
  }

  return maxConsecutive;
};

/**
 * Check if a date is a holiday (from a list of holiday dates)
 */
export const isHoliday = (date: string, holidays: string[]): boolean => {
  return holidays.includes(dayjs(date).format('YYYY-MM-DD'));
};

/**
 * Get today's date in ISO format
 */
export const getToday = (): string => {
  return dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD');
};

/**
 * Get current day of month (1-31)
 */
export const getDayOfMonth = (date?: string): number => {
  return dayjs(date).tz(DEFAULT_TIMEZONE).date();
};

export { dayjs };
