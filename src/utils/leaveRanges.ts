/**
 * 指定排休的日期區間工具。
 * 資料仍以「每天一筆」的字串陣列（YYYY-MM-DD）儲存與傳輸；畫面上把連續的日期合併成一段顯示。
 */

export interface LeaveRange {
  /** 起日（YYYY-MM-DD） */
  start: string;
  /** 迄日（YYYY-MM-DD），單日時與起日相同 */
  end: string;
  /** 這一段包含的每一天 */
  days: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 把起訖日（含）展開成每一天；起日晚於迄日時會自動對調 */
export const expandRange = (start: string, end: string): string[] => {
  const a = Math.min(toMs(start), toMs(end));
  const b = Math.max(toMs(start), toMs(end));
  const days: string[] = [];
  for (let t = a; t <= b; t += DAY_MS) days.push(toStr(t));
  return days;
};

/** 合併並排序日期（去除重複） */
export const mergeDates = (current: string[], added: string[]): string[] =>
  [...new Set([...current, ...added])].sort();

/** 把日期依「連續」分成多段 */
export const groupLeaveRanges = (dates: string[] = []): LeaveRange[] => {
  const sorted = [...new Set(dates)].sort();
  const ranges: LeaveRange[] = [];
  for (const d of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && toMs(d) - toMs(last.end) === DAY_MS) {
      last.end = d;
      last.days.push(d);
    } else {
      ranges.push({ start: d, end: d, days: [d] });
    }
  }
  return ranges;
};

/** 顯示文字：單日「2026-11-10」，多日「2026-11-10 ~ 2026-11-14」 */
export const formatLeaveRange = (r: LeaveRange): string =>
  r.start === r.end ? r.start : `${r.start} ~ ${r.end}`;

/** 整份清單的顯示文字，各段以「、」分隔 */
export const formatLeaveRanges = (dates: string[] = []): string =>
  groupLeaveRanges(dates).map(formatLeaveRange).join('、');
