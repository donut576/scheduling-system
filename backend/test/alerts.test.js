import test from 'node:test';
import assert from 'node:assert/strict';
import {
  durationMinutes, timesOverlap, consecutiveRunLength, evaluateAlerts,
} from '../src/services/alertRules.js';

const base = {
  date: '2026-12-10', timeMode: 'FIXED', startTime: '09:00', endTime: '11:00',
  headcount: 1, assigneeIds: ['1'], requiredLicenses: [],
};
const ctx = (extra = {}) => ({ licensesByEmployee: {}, onLeave: [], otherTasks: [], ...extra });
const ids = (r) => r.violations.map((v) => v.ruleId);
const other = (date, startTime, endTime, assigneeIds = ['1'], timeMode = 'FIXED') =>
  ({ date, timeMode, startTime, endTime, assigneeIds });

test('時長：一般、跨夜、剛好 10 小時', () => {
  assert.equal(durationMinutes('09:00', '11:30'), 150);
  assert.equal(durationMinutes('22:00', '06:00'), 480);
  assert.equal(durationMinutes('08:00', '18:00'), 600);
});

test('時段重疊：相鄰不算重疊、跨夜要算', () => {
  assert.equal(timesOverlap('09:00', '11:00', '11:00', '13:00'), false);
  assert.equal(timesOverlap('09:00', '11:00', '10:00', '12:00'), true);
  assert.equal(timesOverlap('22:00', '06:00', '05:00', '07:00'), true);
  assert.equal(timesOverlap('22:00', '06:00', '08:00', '10:00'), false);
  assert.equal(timesOverlap('22:00', '06:00', '23:00', '05:00'), true);
});

test('連續上班天數：只算包含該日的那一段', () => {
  assert.equal(consecutiveRunLength([], '2026-12-10'), 1);
  assert.equal(consecutiveRunLength(['2026-12-08', '2026-12-09', '2026-12-11'], '2026-12-10'), 4);
  assert.equal(consecutiveRunLength(['2026-12-01', '2026-12-02', '2026-12-03'], '2026-12-10'), 1);
});

test('沒有指派人員就不檢查', () => {
  const r = evaluateAlerts({ ...base, assigneeIds: [], headcount: 3, requiredLicenses: ['PEST_CONTROL'] }, ctx());
  assert.deepEqual(r, { isValid: true, violations: [], canOverride: true });
});

test('人數還沒湊滿：不檢查人數與證照，其他規則照常檢查', () => {
  const t = { ...base, headcount: 2, requiredLicenses: ['PEST_CONTROL'] };
  assert.deepEqual(ids(evaluateAlerts(t, ctx())), []);
  assert.deepEqual(ids(evaluateAlerts(t, ctx({ onLeave: ['1'] }))), ['DESIGNATED_LEAVE']);
  assert.deepEqual(ids(evaluateAlerts(t, ctx({ otherTasks: [other('2026-12-10', '10:00', '12:00')] }))), ['DUPLICATE_SLOT']);
});

test('證照：只要有一位同時持有全部要求證照就通過', () => {
  const t = { ...base, assigneeIds: ['1', '2'], headcount: 2, requiredLicenses: ['PEST_CONTROL', 'PROFESSIONAL'] };
  assert.deepEqual(ids(evaluateAlerts(t, ctx({ licensesByEmployee: { 1: ['PEST_CONTROL'], 2: ['PROFESSIONAL'] } }))), ['LICENSE_REQUIRED']);
  assert.deepEqual(ids(evaluateAlerts(t, ctx({ licensesByEmployee: { 1: ['PEST_CONTROL', 'PROFESSIONAL'] } }))), []);
});

test('沒有日期時只檢查證照（且要湊滿人數才檢查）', () => {
  const t = { ...base, date: null, headcount: 1, requiredLicenses: ['PEST_CONTROL'] };
  assert.deepEqual(ids(evaluateAlerts(t, ctx())), ['LICENSE_REQUIRED']);
  assert.deepEqual(ids(evaluateAlerts({ ...t, headcount: 2 }, ctx())), []);
});

test('指定休假', () => {
  const r = evaluateAlerts(base, ctx({ onLeave: ['1'] }));
  assert.deepEqual(ids(r), ['DESIGNATED_LEAVE']);
  assert.deepEqual(r.violations[0].affectedEmployees, ['1']);
});

test('同時段重複排班：重疊違規、相鄰與別天不違規、彈性任務不比對', () => {
  assert.deepEqual(ids(evaluateAlerts(base, ctx({ otherTasks: [other('2026-12-10', '10:00', '12:00')] }))), ['DUPLICATE_SLOT']);
  assert.deepEqual(ids(evaluateAlerts(base, ctx({ otherTasks: [other('2026-12-10', '11:00', '12:00')] }))), []);
  assert.deepEqual(ids(evaluateAlerts(base, ctx({ otherTasks: [other('2026-12-11', '09:00', '11:00')] }))), []);
  assert.deepEqual(ids(evaluateAlerts(base, ctx({ otherTasks: [other('2026-12-10', null, null, ['1'], 'FLEXIBLE')] }))), []);
  assert.deepEqual(ids(evaluateAlerts({ ...base, timeMode: 'FLEXIBLE', startTime: null, endTime: null },
    ctx({ otherTasks: [other('2026-12-10', '09:00', '11:00')] }))), []);
});

test('只有被指派的那位員工的任務才算', () => {
  assert.deepEqual(ids(evaluateAlerts(base, ctx({ otherTasks: [other('2026-12-10', '10:00', '12:00', ['2'])] }))), []);
});

test('單日工時：超過 600 分鐘違規，剛好 600 不違規', () => {
  const t = { ...base, startTime: '08:00', endTime: '14:00' }; // 6 小時
  assert.deepEqual(ids(evaluateAlerts(t, ctx({ otherTasks: [other('2026-12-10', '14:00', '18:00')] }))), []); // 剛好 10 小時
  assert.deepEqual(ids(evaluateAlerts(t, ctx({ otherTasks: [other('2026-12-10', '14:00', '18:30')] }))), ['DAILY_HOURS_EXCEEDED']);
});

test('跨夜任務的工時算在開始那天', () => {
  const t = { ...base, startTime: '20:00', endTime: '07:00' }; // 11 小時，算在 12/10
  assert.deepEqual(ids(evaluateAlerts(t, ctx())), ['DAILY_HOURS_EXCEEDED']);
  // 前一晚的跨夜任務不影響 12/10 的工時
  assert.deepEqual(ids(evaluateAlerts(base, ctx({ otherTasks: [other('2026-12-09', '20:00', '07:00')] }))), []);
});

test('連續上班：第 7 天可以、第 8 天違規', () => {
  const six = ['2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09'].map((d) => other(d, '09:00', '11:00'));
  assert.deepEqual(ids(evaluateAlerts(base, ctx({ otherTasks: six }))), []); // 加上 12/10 共 7 天
  const seven = [...six, other('2026-12-03', '09:00', '11:00')];
  assert.deepEqual(ids(evaluateAlerts(base, ctx({ otherTasks: seven }))), ['CONSECUTIVE_DAYS']);
});

test('所有違規都是 BLOCKING，且 canOverride 為 true', () => {
  const r = evaluateAlerts({ ...base, requiredLicenses: ['PEST_CONTROL'] },
    ctx({ onLeave: ['1'], otherTasks: [other('2026-12-10', '10:00', '12:00')] }));
  assert.ok(r.violations.length >= 2);
  assert.ok(r.violations.every((v) => v.severity === 'BLOCKING'));
  assert.equal(r.canOverride, true);
});
