import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

/**
 * Pure date-check utilities for the notification management page.
 *
 * These are extracted as standalone pure functions (rather than inlined in the
 * page component) so they can be property-tested independently in task 16.3
 * (Property 23: 通知發送日期區間啟用) without needing to render React components.
 */

/**
 * Checks whether the given date falls within the manual notification send
 * window: the 20th through the 31st (inclusive) of the month.
 *
 * Validates: Requirements 12.2
 */
export const isManualSendWindow = (date: Dayjs | string | Date = dayjs()): boolean => {
  const day = dayjs(date).date();
  return day >= 20 && day <= 31;
};

/**
 * Determines whether the manual notification send action should be enabled.
 *
 * Per Requirement 12.2, manual send should be enabled *iff* the current date
 * is within the 20-31 window AND there is new schedule data requiring
 * notification. Since the API has no dedicated "new schedule exists" signal,
 * we use the presence of NOT_NOTIFIED / CHANGED_NOT_NOTIFIED records in the
 * current notification dataset as the proxy signal for "new schedule
 * produced notifications pending send" (these statuses represent
 * notifications that have not yet been sent to their recipients).
 *
 * Validates: Requirements 12.2
 */
export const isManualSendEnabled = (
  hasPendingNotifications: boolean,
  date: Dayjs | string | Date = dayjs(),
): boolean => isManualSendWindow(date) && hasPendingNotifications;

/**
 * Checks whether the given date is the 15th of the month, which is when
 * group leaders (組長) should be reminded to proceed with scheduling.
 *
 * Validates: Requirements 12.1
 */
export const isScheduleReminderDay = (date: Dayjs | string | Date = dayjs()): boolean =>
  dayjs(date).date() === 15;
