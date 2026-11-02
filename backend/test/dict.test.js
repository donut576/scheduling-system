import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDict } from '../src/services/dict.js';

// 用假的 query 測試轉換邏輯，不需要資料庫
const fakeQuery = async (sql) => {
  if (sql.includes('service_contents')) return { rows: [{ code: 'P', name: 'P' }, { code: 'TERMITE', name: '白蟻' }] };
  if (sql.includes('shifts')) return { rows: [{ name: '早班' }, { name: '午班' }] };
  if (sql.includes('licenses')) return { rows: [{ code: 'PEST_CONTROL', license_name: '施藥' }] };
  if (sql.includes('positions')) return { rows: [{ code: 'LEADER', name: '主任' }] };
  throw new Error(`未預期的查詢：${sql}`);
};

test('字典轉成前端的 { label, value } 格式', async () => {
  const d = await buildDict(fakeQuery);
  assert.deepEqual(d.contents, [{ label: 'P', value: 'P' }, { label: '白蟻', value: 'TERMITE' }]);
  assert.deepEqual(d.shifts, [{ label: '早班', value: '早班' }, { label: '午班', value: '午班' }]);
  assert.deepEqual(d.positions, [{ label: '主任', value: 'LEADER' }]);
});

test('證照第一項是「無」，任務類型與路線有固定選項', async () => {
  const d = await buildDict(fakeQuery);
  assert.deepEqual(d.licenses[0], { label: '無', value: 'NONE' });
  assert.equal(d.licenses[1].value, 'PEST_CONTROL');
  assert.equal(d.taskTypes.length, 3);
  assert.equal(d.routes.length, 8);
});
