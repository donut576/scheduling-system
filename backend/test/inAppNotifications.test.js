import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, appendHistory, HISTORY_LIMIT } from '../src/services/inAppNotifications.js';

const state = (o = {}) => ({
  groupName: '樂雅樂', branchName: '觀音店', taskType: 'CONTRACT', date: '2026-11-20', timeMode: 'FIXED',
  startTime: '14:30', endTime: '16:00', timeRemark: null, address: 'A 路 1 號', remarks: null, contents: ['P', 'TERMITE'],
  assignees: [{ employeeId: '7', employeeName: '甲' }], ...o,
});

test('新增：時間轉成 HHmm，不帶 previous', () => {
  const p = buildPayload('CREATED', state(), { detail: { after: state() } });
  assert.equal(p.kind, 'TASK_CHANGE');
  assert.equal(p.time, '1430');
  assert.equal(p.flexible, false);
  assert.equal(p.previous, undefined);
  assert.deepEqual(p.changedFields, []);
});

test('修改時間：changedFields 轉成前端欄位，previous 放舊時間', () => {
  const before = state({ startTime: '09:00' });
  const p = buildPayload('UPDATED', state(), { detail: { changedFields: ['startTime', 'endTime'], before, after: state() } });
  assert.deepEqual(p.changedFields, ['time']);
  assert.equal(p.previous.time, '0900');
});

test('修改地址與內容：location、contents 各一次，previous 放舊值', () => {
  const before = state({ address: '舊地址', contents: ['P'] });
  const p = buildPayload('UPDATED', state(), { detail: { changedFields: ['address', 'branchId', 'contents'], before, after: state() } });
  assert.deepEqual(p.changedFields.sort(), ['contents', 'location']);
  assert.equal(p.previous.address, '舊地址');
  assert.deepEqual(p.previous.contents, ['P']);
});

test('只換同事（assignees）：算修改，但沒有被標示的欄位', () => {
  const p = buildPayload('UPDATED', state(), { detail: { changedFields: ['assignees'], before: state(), after: state() } });
  assert.deepEqual(p.changedFields, []);
});

test('彈性任務：flexible 為 true', () => {
  const p = buildPayload('CREATED', state({ timeMode: 'FLEXIBLE', startTime: null }), { detail: { after: state() } });
  assert.equal(p.flexible, true);
  assert.equal(p.time, undefined);
});

test('歷程：依序累加，超過上限丟掉最舊的', () => {
  let h = [];
  for (let i = 0; i < HISTORY_LIMIT + 3; i += 1) h = appendHistory(h, { n: i });
  assert.equal(h.length, HISTORY_LIMIT);
  assert.equal(h[0].n, 3);
  assert.equal(h.at(-1).n, HISTORY_LIMIT + 2);
});
