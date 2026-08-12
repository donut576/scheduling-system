/**
 * 週期性任務（重複排班）產生工具模組。
 *
 * 依據起始日期與重複規則 (RecurrenceRule)，展開產生所有實際發生日期。
 * 支援每日 (daily)、每週 (weekly，可指定星期幾)、每月 (monthly，可指定日期並
 * 自動處理月底夾擠問題) 與自訂間隔 (custom) 四種頻率，
 * 並支援三種結束條件：指定次數 (count)、指定結束日期 (date)、
 * 或永不結束 (never，此時以上限次數保護避免產生過多實例)。
 */
import type { RecurrenceRule } from '@/types/task';

/**
 * 當 endType 為 'never'（永不結束）時，最多產生的實例數量上限，
 * 避免無限期產生資料。
 */
const MAX_NEVER_INSTANCES = 52;

/**
 * 迴圈最大執行次數，用於防止意外情況下產生無窮迴圈。
 */
const MAX_ITERATIONS = 10000;

/**
 * 依據起始日期與重複規則，產生所有重複實例之日期清單。
 * 回傳值為 ISO 日期字串陣列 (YYYY-MM-DD)。
 *
 * @param startDate 首次發生日期（YYYY-MM-DD 格式）
 * @param rule 重複規則，定義頻率 (frequency)、間隔 (interval) 與結束條件
 * @returns 代表每次發生日期之 ISO 日期字串陣列
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
      // 若指定了特定星期幾，走「依星期展開」邏輯；否則每 interval 週重複同一天
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
 * 產生每日 / 自訂間隔頻率之重複實例。
 * 每個實例恰好為前一個實例之後 `interval` 天。
 *
 * @param start 起始日期
 * @param rule 重複規則
 * @returns 重複實例之日期字串陣列
 */
function generateDaily(start: Date, rule: RecurrenceRule): string[] {
  const instances: string[] = [];
  const maxCount = getTargetCount(rule);
  const endDate = rule.endType === 'date' && rule.endDate ? parseDate(rule.endDate) : null;

  let current = new Date(start);

  for (let i = 0; i < maxCount; i++) {
    // 若已設定結束日期且目前日期已超過，則停止產生
    if (endDate && current > endDate) break;
    instances.push(formatDate(current));
    current = new Date(current);
    current.setDate(current.getDate() + rule.interval);
  }

  return instances;
}

/**
 * 產生每週頻率（未指定特定星期幾）之重複實例。
 * 每個實例恰好為前一個實例之後 `interval * 7` 天（即每隔 interval 週，同一星期幾）。
 *
 * @param start 起始日期
 * @param rule 重複規則
 * @returns 重複實例之日期字串陣列
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
 * 產生每週頻率（指定特定星期幾）之重複實例。
 * 實例會落在指定之星期幾上，每組星期幾之間隔為 `interval` 週。
 *
 * 演算法：先找出起始日期所在那一週的週日（星期幾索引 0），以此為基準週；
 * 之後在每個基準週中，依序檢查所有指定的星期幾是否可作為候選日期
 * （需不早於起始日期、且不晚於結束日期），若通過則加入結果；
 * 每完成一個基準週的檢查後，將基準週往後推進 `interval` 週再繼續。
 *
 * @param start 起始日期
 * @param rule 重複規則（daysOfWeek 為 0-6，0 代表星期日）
 * @returns 重複實例之日期字串陣列
 */
function generateWeeklyWithDays(start: Date, rule: RecurrenceRule): string[] {
  const instances: string[] = [];
  const maxCount = getTargetCount(rule);
  const endDate = rule.endType === 'date' && rule.endDate ? parseDate(rule.endDate) : null;
  // 依星期幾數值排序，確保同一週內依序（週日到週六）產生日期
  const daysOfWeek = [...(rule.daysOfWeek ?? [])].sort((a, b) => a - b);

  // 找出起始日期所屬那一週的週日（星期幾索引：星期日 = 0）
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

      // 跳過早於起始日期之候選日期（例如起始日為週三，但規則含週一/週二）
      if (candidate < start) continue;

      // 若已超過結束日期，直接結束並回傳目前已收集之實例
      if (endDate && candidate > endDate) return instances;

      instances.push(formatDate(candidate));
    }

    // 推進至下一個間隔週
    currentWeekStart.setDate(currentWeekStart.getDate() + rule.interval * 7);
  }

  return instances;
}

/**
 * 產生每月頻率之重複實例。
 * 實例會落在指定之 dayOfMonth（若未指定則沿用起始日期之日），
 * 每次間隔 `interval` 個月，並自動處理月底夾擠（如指定 31 日但該月只有 30 天）。
 *
 * @param start 起始日期
 * @param rule 重複規則
 * @returns 重複實例之日期字串陣列
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

    // 往後推進 interval 個月，並處理跨年進位
    currentMonth += rule.interval;
    while (currentMonth >= 12) {
      currentMonth -= 12;
      currentYear++;
    }
  }

  return instances;
}

/**
 * 依指定之年、月、目標日，取得對應之日期物件；
 * 若目標日超出該月實際天數（例如指定 31 日但該月僅有 30 天），
 * 則自動夾擠（clamp）為該月的最後一天。
 *
 * @param year 年份
 * @param month 月份（0-indexed，0 代表 1 月）
 * @param targetDay 目標日（1-31）
 * @returns 夾擠後之有效日期物件
 */
function getMonthlyDate(year: number, month: number, targetDay: number): Date {
  // 取得下個月第 0 天，即為當月最後一天
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(targetDay, lastDay);
  return new Date(year, month, day);
}

/**
 * 決定應產生之目標實例數量上限。
 *
 * - 'count'：以 endCount 指定之次數為上限（未指定則回退至永不結束的上限值）
 * - 'never'：使用 MAX_NEVER_INSTANCES 作為安全上限，避免無限產生
 * - 'date'：回傳一個很大的上限值 (MAX_ITERATIONS)，實際結束時機由迴圈內的
 *   結束日期檢查來控制，此上限僅作為防止無窮迴圈的保護機制
 *
 * @param rule 重複規則
 * @returns 目標實例數量上限
 */
function getTargetCount(rule: RecurrenceRule): number {
  switch (rule.endType) {
    case 'count':
      return rule.endCount ?? MAX_NEVER_INSTANCES;
    case 'never':
      return MAX_NEVER_INSTANCES;
    case 'date':
      return MAX_ITERATIONS; // 實際結束時機由迴圈中的結束日期檢查控制
    default:
      return MAX_NEVER_INSTANCES;
  }
}

/**
 * 將 YYYY-MM-DD 格式之日期字串解析為 Date 物件（以本地時間表示）。
 *
 * @param dateStr 日期字串（YYYY-MM-DD）
 * @returns 對應之 Date 物件
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

/**
 * 將 Date 物件格式化為 YYYY-MM-DD 字串。
 *
 * @param date 欲格式化之日期物件
 * @returns YYYY-MM-DD 格式字串
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
