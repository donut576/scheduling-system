import { describe, expect, it } from 'vitest';
import { expandRange, formatLeaveRanges, groupLeaveRanges, mergeDates } from './leaveRanges';

describe('leaveRanges', () => {
  it('expandRange 含頭尾，跨月也正確', () => {
    expect(expandRange('2026-11-29', '2026-12-02')).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
  });

  it('expandRange 單日與起訖顛倒', () => {
    expect(expandRange('2026-11-10', '2026-11-10')).toEqual(['2026-11-10']);
    expect(expandRange('2026-11-12', '2026-11-10')).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
  });

  it('mergeDates 去重並排序', () => {
    expect(mergeDates(['2026-11-12', '2026-11-10'], ['2026-11-10', '2026-11-11'])).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
  });

  it('groupLeaveRanges 連續日期合成一段，不連續分開', () => {
    const r = groupLeaveRanges(['2026-11-20', '2026-11-10', '2026-11-11', '2026-11-12']);
    expect(r.map((x) => [x.start, x.end])).toEqual([
      ['2026-11-10', '2026-11-12'],
      ['2026-11-20', '2026-11-20'],
    ]);
    expect(r[0]?.days).toHaveLength(3);
  });

  it('formatLeaveRanges 顯示文字', () => {
    expect(formatLeaveRanges(['2026-11-10', '2026-11-11', '2026-11-20'])).toBe(
      '2026-11-10 ~ 2026-11-11、2026-11-20',
    );
    expect(formatLeaveRanges([])).toBe('');
  });
});
