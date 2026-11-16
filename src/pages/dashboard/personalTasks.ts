/**
 * 儀表板「個人任務／今日班表」資料整理（純函式，方便測試）
 */
import type { ScheduleEvent } from '@/types/schedule';
import type { TaskAssignee } from '@/types/task';

export type TaskRange = 'day' | 'week' | 'month';

export interface PersonalTask {
  id: string;
  taskId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 固定時間 4 碼（例：1430）；彈性任務為 null */
  time: string | null;
  flexible: boolean;
  timeRemark?: string;
  /** 任務所屬群組（轄區＋班別）的顏色；沒有時畫面退回第一位同仁的顏色 */
  regionColor?: string;
  /** 詳細視窗用：客戶地址與聯絡窗口、同仁電話（後端跟著班表事件回傳） */
  customerInfo?: NonNullable<ScheduleEvent['extendedProps']['customerInfo']>;
  assigneePhones?: Record<string, string>;
  groupName: string;
  branchName: string;
  branchId: string;
  taskType?: string;
  contents: string[];
  headcount: number;
  assignees: TaskAssignee[];
  reportTypes: string[];
  photoCount?: number;
  reportNotes?: string;
  remarks?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → YYYY-MM-DD（本機日期） */
export const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 字串日期加減天數 */
export const addDays = (dateStr: string, n: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return toDateStr(new Date(y, m - 1, d + n));
};

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

/** `11/13 週五` */
export const formatMonthDayWeek = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return `${m}/${d} 週${WEEKDAY[new Date(y, m - 1, d).getDay()]}`;
};

/** 依檢視範圍與位移（offset）回傳起迄日（含）與顯示標籤 */
export function getRangeInfo(
  range: TaskRange,
  offset: number,
  today: string,
): { start: string; end: string; label: string } {
  if (range === 'day') {
    const date = addDays(today, offset);
    return {
      start: date,
      end: date,
      label: offset === 0 ? `今日 ${formatMonthDayWeek(date)}` : formatMonthDayWeek(date),
    };
  }
  if (range === 'week') {
    const start = addDays(today, offset * 7);
    const end = addDays(start, 6);
    const f = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
    return { start, end, label: `${f(start)} – ${f(end)}` };
  }
  const [y, m] = today.split('-').map(Number) as [number, number];
  const first = new Date(y, m - 1 + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return {
    start: toDateStr(first),
    end: toDateStr(last),
    label: `${first.getFullYear()} 年 ${first.getMonth() + 1} 月`,
  };
}

/** 排班事件是否「已排滿」：非待排／取消、有時間（固定或彈性）、指派人數 ≥ 需求人數 */
export function isFullyAssigned(ev: ScheduleEvent): boolean {
  const status = ev.extendedProps.task?.status;
  if (status === 'UNSCHEDULED' || status === 'CANCELLED') return false;
  const flexible = ev.extendedProps.timeMode === 'FLEXIBLE';
  if (!flexible && !ev.start) return false;
  const need = ev.extendedProps.headcount ?? ev.extendedProps.task?.headcount ?? 1;
  return ev.extendedProps.assignees.length >= need && ev.extendedProps.assignees.length > 0;
}

/** ScheduleEvent → PersonalTask */
export function toPersonalTask(ev: ScheduleEvent): PersonalTask {
  const p = ev.extendedProps;
  const flexible = p.timeMode === 'FLEXIBLE';
  const need = p.headcount ?? p.task?.headcount ?? p.assignees.length;
  return {
    id: ev.id,
    taskId: ev.taskId,
    date: ev.start.slice(0, 10),
    time: flexible ? null : ev.start.slice(11, 16).replace(':', ''),
    flexible,
    timeRemark: p.timeRemark,
    regionColor: p.regionColor,
    customerInfo: p.customerInfo,
    assigneePhones: p.assigneePhones,
    groupName: ev.groupName,
    branchName: ev.branchName,
    branchId: ev.resourceId,
    taskType: p.taskType,
    contents: (p.contents ?? []) as string[],
    headcount: need,
    assignees: p.assignees,
    reportTypes: (p.reportTypes ?? []) as string[],
    photoCount: p.photoCount,
    reportNotes: p.reportNotes,
    remarks: p.remarks,
  };
}

/**
 * 篩出要顯示的任務並排序（同日：固定時間由早到晚、彈性排最後）。
 * 員工僅看自己；其他角色已由上層以轄區／全部處理，這裡只負責排滿＋範圍。
 */
export function buildPersonalTasks(
  events: ScheduleEvent[],
  opts: { start: string; end: string; employeeId?: string },
): PersonalTask[] {
  return events
    .filter(isFullyAssigned)
    .map(toPersonalTask)
    .filter((t) => t.date >= opts.start && t.date <= opts.end)
    .filter((t) => !opts.employeeId || t.assignees.some((a) => a.employeeId === opts.employeeId))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.flexible !== b.flexible) return a.flexible ? 1 : -1;
      return (a.time ?? '').localeCompare(b.time ?? '');
    });
}

/** 依日期分組（保持排序） */
export function groupByDate(tasks: PersonalTask[]): { date: string; items: PersonalTask[] }[] {
  const out: { date: string; items: PersonalTask[] }[] = [];
  tasks.forEach((t) => {
    const last = out[out.length - 1];
    if (last && last.date === t.date) last.items.push(t);
    else out.push({ date: t.date, items: [t] });
  });
  return out;
}

/** 施作同仁顯示：自己叫「我」；3 人以上只列前兩位 + 「等」 */
export function formatAssigneeNames(assignees: TaskAssignee[], selfId?: string): string {
  const names = assignees.map((a) => (a.employeeId === selfId ? '我' : a.employeeName));
  return names.length >= 3 ? `${names.slice(0, 2).join('、')} 等` : names.join('、');
}
