import { AppError, ERROR_CODES } from '../utils/response.js';

// 循環任務規則：只支援每週、每月、每季；一定要有結束條件（指定日期或指定次數）；
// 一次展開全部任務，最多 104 筆（2 年 × 每週 1 次）、結束日最晚為起始日後 2 年。
// 每月／每季指定的日期（例如 31 號）在沒有那一天的月份，改成當月最後一天。
export const MAX_OCCURRENCES = 104;
export const MAX_YEARS = 2;
const MAX_INTERVAL = { weekly: 52, monthly: 12, quarterly: 4 };

const bad = (msg) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, `資料驗證失敗：${msg}`);
const pad = (n) => String(n).padStart(2, '0');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s) => typeof s === 'string' && DATE_RE.test(s)
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const split = (s) => ({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)), d: Number(s.slice(8, 10)) });
const fmt = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const addDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const weekdayOf = (s) => new Date(`${s}T00:00:00Z`).getUTCDay(); // 0 = 週日
const addMonthsClamped = (s, n, day) => {
  const { y, m } = split(s);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12); const nm = (idx % 12) + 1;
  return fmt(ny, nm, Math.min(day, daysInMonth(ny, nm)));
};

// 檢查前端傳來的規則，回傳整理好的規則（缺的星期／日期用起始日補上）
export const normalizeRule = (rule, startDate) => {
  if (!rule || typeof rule !== 'object') throw bad('recurrence 格式錯誤');
  if (!isRealDate(startDate)) throw bad('循環任務必須填寫正確的起始日期');
  const { frequency } = rule;
  if (!MAX_INTERVAL[frequency]) throw bad('循環頻率只支援每週（weekly）、每月（monthly）、每季（quarterly）');
  const interval = rule.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > MAX_INTERVAL[frequency]) {
    throw bad(`間隔必須是 1 到 ${MAX_INTERVAL[frequency]} 的整數`);
  }
  const out = { frequency, interval };
  if (frequency === 'weekly') {
    const days = rule.daysOfWeek;
    if (days !== undefined && days !== null && (!Array.isArray(days) || days.length !== 1 || !Number.isInteger(days[0]) || days[0] < 0 || days[0] > 6)) {
      throw bad('每週循環只能選一個星期（0 到 6）');
    }
    out.dayOfWeek = days?.[0] ?? weekdayOf(startDate);
  } else {
    const day = rule.dayOfMonth ?? split(startDate).d;
    if (!Number.isInteger(day) || day < 1 || day > 31) throw bad('每月日期必須是 1 到 31');
    out.dayOfMonth = day;
  }
  if (rule.endType !== 'date' && rule.endType !== 'count') throw bad('循環任務一定要有結束條件（指定日期或指定次數）');
  out.endType = rule.endType;
  if (rule.endType === 'date') {
    if (!isRealDate(rule.endDate)) throw bad('請填寫正確的結束日期');
    if (rule.endDate <= startDate) throw bad('結束日期必須晚於起始日期');
    const limit = addMonthsClamped(startDate, MAX_YEARS * 12, split(startDate).d);
    if (rule.endDate > limit) throw bad(`結束日期最晚為起始日期後 ${MAX_YEARS} 年（${limit}）`);
    out.endDate = rule.endDate;
  } else {
    const n = rule.endCount;
    if (!Number.isInteger(n) || n < 2 || n > MAX_OCCURRENCES) throw bad(`重複次數必須是 2 到 ${MAX_OCCURRENCES} 的整數`);
    out.endCount = n;
  }
  return out;
};

// 依規則展開所有日期（含第一筆），由小到大。超過 104 筆或少於 2 筆都回 422。
export const expandRecurrence = (startDate, rawRule) => {
  const rule = normalizeRule(rawRule, startDate);
  const limitDate = rule.endType === 'date' ? rule.endDate : addMonthsClamped(startDate, MAX_YEARS * 12, split(startDate).d);
  const dates = [];
  const push = (d) => {
    if (d < startDate) return true;
    if (d > limitDate) return false;
    if (rule.endType === 'count' && dates.length >= rule.endCount) return false;
    dates.push(d);
    if (dates.length > MAX_OCCURRENCES) throw bad(`循環任務最多 ${MAX_OCCURRENCES} 筆，請縮短結束日期或減少次數`);
    return true;
  };
  if (rule.frequency === 'weekly') {
    const first = addDays(startDate, (rule.dayOfWeek - weekdayOf(startDate) + 7) % 7);
    for (let k = 0; k < 1000; k += 1) if (!push(addDays(first, k * 7 * rule.interval))) break;
  } else {
    const step = rule.interval * (rule.frequency === 'quarterly' ? 3 : 1);
    for (let k = 0; k < 1000; k += 1) if (!push(addMonthsClamped(startDate, k * step, rule.dayOfMonth))) break;
  }
  if (dates.length < 2) throw bad('這個循環規則只會產生 1 筆任務，請調整結束條件');
  return { rule, dates };
};
