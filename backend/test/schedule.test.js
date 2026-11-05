import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, eventRange, overlapsRange, MAX_RANGE_DAYS } from '../src/services/schedule.js';

const row = (o) => ({ date: '2026-11-04', time_mode: 'FIXED', start_time: '09:00', end_time: '11:00', is_overnight: false, ...o });

test('日期加減：跨月、跨年', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
});

test('事件時間：固定時段、跨夜（結束在隔天）、彈性任務整天', () => {
  assert.deepEqual(eventRange(row({})), { start: '2026-11-04T09:00:00+08:00', end: '2026-11-04T11:00:00+08:00' });
  assert.deepEqual(eventRange(row({ start_time: '22:00', end_time: '06:00', is_overnight: true })),
    { start: '2026-11-04T22:00:00+08:00', end: '2026-11-05T06:00:00+08:00' });
  assert.deepEqual(eventRange(row({ time_mode: 'FLEXIBLE', start_time: null, end_time: null })),
    { start: '2026-11-04T00:00:00+08:00', end: '2026-11-04T23:59:00+08:00' });
});

test('查詢範圍：前一晚開始的跨夜任務算進來，範圍外的不算', () => {
  const overnight = eventRange(row({ date: '2026-10-31', start_time: '22:00', end_time: '02:00', is_overnight: true }));
  assert.equal(overlapsRange(overnight, '2026-11-01', '2026-11-30'), true);
  const before = eventRange(row({ date: '2026-10-31' }));
  assert.equal(overlapsRange(before, '2026-11-01', '2026-11-30'), false);
  const inside = eventRange(row({ date: '2026-11-30' }));
  assert.equal(overlapsRange(inside, '2026-11-01', '2026-11-30'), true);
  const after = eventRange(row({ date: '2026-12-01' }));
  assert.equal(overlapsRange(after, '2026-11-01', '2026-11-30'), false);
});

test('查詢範圍上限是 62 天', () => {
  assert.equal(MAX_RANGE_DAYS, 62);
});
