import { describe, it, expect } from 'vitest';
import {
  addDays,
  buildPersonalTasks,
  formatAssigneeNames,
  getRangeInfo,
  groupByDate,
  isFullyAssigned,
} from './personalTasks';
import type { ScheduleEvent } from '@/types/schedule';
import type { TaskAssignee } from '@/types/task';

const asg = (id: string, name: string): TaskAssignee => ({
  employeeId: id,
  employeeName: name,
  licenses: [],
});

const ev = (over: Partial<ScheduleEvent> & { props?: Partial<ScheduleEvent['extendedProps']> }) => {
  const { props, ...rest } = over;
  return {
    id: 'e1',
    taskId: 't1',
    resourceId: 'b1',
    title: 'x',
    start: '2026-11-13T14:30:00',
    end: '2026-11-13T15:30:00',
    groupName: '樂雅樂',
    branchName: '觀音',
    alertStatus: 'CLEAN',
    isRecurring: false,
    isOvernight: false,
    extendedProps: {
      taskType: 'CONTRACT',
      shift: '北早',
      assignees: [asg('u1', '王小明')],
      contents: ['P', 'R'],
      headcount: 1,
      ...props,
    },
    ...rest,
  } as ScheduleEvent;
};

describe('getRangeInfo', () => {
  it('日：今日標籤', () => {
    expect(getRangeInfo('day', 0, '2026-11-13').label).toBe('今日 11/13 週五');
  });
  it('週：從今天起滾動 7 天', () => {
    const r = getRangeInfo('week', 0, '2026-11-13');
    expect(r.start).toBe('2026-11-13');
    expect(r.end).toBe('2026-11-19');
    expect(r.label).toBe('11/13 – 11/19');
  });
  it('月：整月起迄', () => {
    const r = getRangeInfo('month', 0, '2026-11-13');
    expect(r.start).toBe('2026-11-01');
    expect(r.end).toBe('2026-11-30');
    expect(r.label).toBe('2026 年 11 月');
    expect(getRangeInfo('month', 1, '2026-11-13').label).toBe('2026 年 12 月');
  });
});

describe('isFullyAssigned / buildPersonalTasks', () => {
  it('指派人數不足視為待排，不顯示', () => {
    expect(isFullyAssigned(ev({ props: { headcount: 2 } }))).toBe(false);
    expect(isFullyAssigned(ev({ props: { headcount: 1 } }))).toBe(true);
  });
  it('員工只看自己；固定在前、彈性在後', () => {
    const list = buildPersonalTasks(
      [
        ev({ id: 'flex', props: { timeMode: 'FLEXIBLE' } }),
        ev({ id: 'late', start: '2026-11-13T16:00:00' }),
        ev({ id: 'early', start: '2026-11-13T08:00:00' }),
        ev({ id: 'other', props: { assignees: [asg('u2', '李四')] } }),
      ],
      { start: '2026-11-13', end: '2026-11-13', employeeId: 'u1' },
    );
    expect(list.map((t) => t.id)).toEqual(['early', 'late', 'flex']);
    expect(list[0]!.time).toBe('0800');
    expect(list[2]!.time).toBeNull();
  });
  it('超出範圍的不顯示，並可依日期分組', () => {
    const list = buildPersonalTasks(
      [
        ev({ id: 'a' }),
        ev({ id: 'b', start: '2026-11-14T09:00:00' }),
        ev({ id: 'c', start: '2026-12-30T09:00:00' }),
      ],
      { start: '2026-11-13', end: '2026-11-19' },
    );
    expect(groupByDate(list).map((g) => g.date)).toEqual(['2026-11-13', '2026-11-14']);
  });
});

describe('formatAssigneeNames', () => {
  it('自己顯示「我」，3 人以上列前兩位加「等」', () => {
    expect(formatAssigneeNames([asg('u1', 'A')], 'u1')).toBe('我');
    expect(formatAssigneeNames([asg('u1', 'A'), asg('u2', 'B'), asg('u3', 'C')], 'u9')).toBe(
      'A、B 等',
    );
  });
});

describe('addDays', () => {
  it('跨月', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
  });
});
