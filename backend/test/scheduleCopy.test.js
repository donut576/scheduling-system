import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCopyParams, buildSourceFilter, MAX_COPY_DAYS } from '../src/services/scheduleCopy.js';

const base = { sourceStartDate: '2026-11-02', sourceEndDate: '2026-11-08', targetStartDate: '2026-11-09', targetEndDate: '2026-11-15' };
const code = (fn) => { try { fn(); } catch (e) { return e.status; } return null; };

test('複製班表參數：算出平移天數，任務類型預設合約與單次', () => {
  const p = parseCopyParams(base);
  assert.equal(p.offsetDays, 7);
  assert.deepEqual(p.taskTypes, ['CONTRACT', 'ONETIME']);
  assert.equal(p.employeeIds, null);
  assert.equal(parseCopyParams({ ...base, targetStartDate: '2026-10-26', targetEndDate: '2026-11-01' }).offsetDays, -7);
});

test('複製班表參數：缺欄位、日期顛倒、區間太長、目標比來源短、目標等於來源都回 422', () => {
  assert.equal(code(() => parseCopyParams({ ...base, sourceStartDate: undefined })), 422);
  assert.equal(code(() => parseCopyParams({ ...base, sourceEndDate: '2026-11-01' })), 422);
  assert.equal(code(() => parseCopyParams({ ...base, targetEndDate: '2026-11-08' })), 422);
  assert.equal(code(() => parseCopyParams({ ...base, targetEndDate: '2026-11-14' })), 422); // 目標 6 天 < 來源 7 天
  assert.equal(code(() => parseCopyParams({ ...base, targetStartDate: base.sourceStartDate, targetEndDate: base.sourceEndDate })), 422);
  assert.equal(code(() => parseCopyParams({ ...base, sourceEndDate: '2027-02-01', targetEndDate: '2027-03-01', targetStartDate: '2027-02-02' })), 422);
  assert.equal(MAX_COPY_DAYS, 62);
  assert.equal(code(() => parseCopyParams({ ...base, taskTypes: ['X'] })), 422);
});

test('複製班表：目標比來源長可以（只複製一次）', () => {
  assert.equal(parseCopyParams({ ...base, targetEndDate: '2026-11-30' }).offsetDays, 7);
});

test('來源任務條件：一律用參數；不限範圍時沒有轄區條件；範圍為空查不到', () => {
  const p = parseCopyParams({ ...base, employeeIds: ['5', '6'], area: "北早'; DROP--" });
  const f = buildSourceFilter(p, { all: true });
  assert.ok(!f.whereSql.includes('DROP') && !f.whereSql.includes('北早'));
  assert.deepEqual(f.values.slice(0, 3), ['2026-11-02', '2026-11-08', ['CONTRACT', 'ONETIME']]);
  assert.deepEqual(f.values[3], ['5', '6']);
  const none = buildSourceFilter(parseCopyParams(base), { regionNames: [] });
  assert.ok(none.whereSql.includes('FALSE'));
  const scoped = buildSourceFilter(parseCopyParams(base), { regionNames: ['北早'] });
  assert.deepEqual(scoped.values[3], ['北早']);
});
