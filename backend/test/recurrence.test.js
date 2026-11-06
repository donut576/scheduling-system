import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRecurrence, normalizeRule, MAX_OCCURRENCES } from '../src/services/recurrence.js';

const weekly = (extra = {}) => ({ frequency: 'weekly', interval: 1, endType: 'count', endCount: 4, ...extra });

test('每週：從起始日開始，每隔 N 週，指定次數', () => {
  assert.deepEqual(expandRecurrence('2026-11-12', weekly()).dates, ['2026-11-12', '2026-11-19', '2026-11-26', '2026-12-03']);
  assert.deepEqual(expandRecurrence('2026-11-12', weekly({ interval: 2, endCount: 3 })).dates, ['2026-11-12', '2026-11-26', '2026-12-10']);
});

test('每週：指定的星期和起始日不同時，第一筆是起始日之後（含）第一個該星期', () => {
  // 2026-11-12 是週四；指定週一（1）→ 11/16
  assert.deepEqual(expandRecurrence('2026-11-12', weekly({ daysOfWeek: [1], endCount: 2 })).dates, ['2026-11-16', '2026-11-23']);
});

test('每週：結束日期（含當天）', () => {
  const { dates } = expandRecurrence('2026-11-12', weekly({ endType: 'date', endDate: '2026-12-03', endCount: undefined }));
  assert.deepEqual(dates, ['2026-11-12', '2026-11-19', '2026-11-26', '2026-12-03']);
});

test('每月：沒有那一天的月份改成當月最後一天（31、30、29 號都一樣）', () => {
  const m31 = expandRecurrence('2026-01-31', { frequency: 'monthly', interval: 1, endType: 'count', endCount: 5 }).dates;
  assert.deepEqual(m31, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  const m30 = expandRecurrence('2026-01-30', { frequency: 'monthly', interval: 1, endType: 'count', endCount: 3 }).dates;
  assert.deepEqual(m30, ['2026-01-30', '2026-02-28', '2026-03-30']);
  const leap = expandRecurrence('2028-01-29', { frequency: 'monthly', interval: 1, endType: 'count', endCount: 3 }).dates;
  assert.deepEqual(leap, ['2028-01-29', '2028-02-29', '2028-03-29']);
});

test('每月：指定日期早於起始日時，第一筆是下個月；每季：每 3 個月', () => {
  const r = expandRecurrence('2026-11-20', { frequency: 'monthly', interval: 1, dayOfMonth: 5, endType: 'count', endCount: 2 }).dates;
  assert.deepEqual(r, ['2026-12-05', '2027-01-05']);
  const q = expandRecurrence('2026-11-30', { frequency: 'quarterly', interval: 1, endType: 'count', endCount: 3 }).dates;
  assert.deepEqual(q, ['2026-11-30', '2027-02-28', '2027-05-30']);
});

test('規則檢查：不能不結束、不支援 daily／custom、日期與次數範圍', () => {
  const bad = (rule, start = '2026-11-12') => assert.throws(() => expandRecurrence(start, rule), (e) => e.status === 422);
  bad({ frequency: 'weekly', interval: 1, endType: 'never' });
  bad({ frequency: 'daily', interval: 1, endType: 'count', endCount: 3 });
  bad({ frequency: 'custom', interval: 1, endType: 'count', endCount: 3 });
  bad(weekly({ interval: 53 }));
  bad(weekly({ interval: 0 }));
  bad(weekly({ daysOfWeek: [1, 3] })); // 每週只能選一個星期
  bad(weekly({ endCount: 1 }));
  bad(weekly({ endCount: MAX_OCCURRENCES + 1 }));
  bad(weekly({ endType: 'date', endDate: '2026-11-12' })); // 結束日要晚於起始日
  bad(weekly({ endType: 'date', endDate: '2028-11-13' })); // 超過 2 年
  bad(weekly({ endType: 'date', endDate: '2026-02-30' })); // 不存在的日期
  assert.throws(() => normalizeRule(weekly(), 'abc'), (e) => e.status === 422);
});

test('筆數上限：每週 104 筆可以，第 105 筆會被擋', () => {
  assert.equal(expandRecurrence('2026-11-12', weekly({ endCount: 104 })).dates.length, 104);
  const edge = expandRecurrence('2026-11-12', weekly({ endType: 'date', endDate: '2028-11-02', endCount: undefined }));
  assert.equal(edge.dates.length, 104);
  // 2 年整（2028-11-12）每週會有 105 筆，超過上限
  assert.throws(() => expandRecurrence('2026-11-12', weekly({ endType: 'date', endDate: '2028-11-12', endCount: undefined })), (e) => e.status === 422);
});
