import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLabel, buildMail, toLogItems } from '../src/services/mailDigest.js';

const snap = (o = {}) => ({
  id: '1', status: 'SCHEDULED', groupName: '樂雅樂', branchName: '觀音店', branchId: '10', date: '2026-11-20', timeMode: 'FIXED',
  startTime: '14:30', endTime: '16:00', timeRemark: null, remarks: null, address: 'A 路 1 號', contents: ['P', 'TERMITE'],
  assignees: [{ employeeId: '7', employeeName: '甲' }], ...o,
});
const ch = (type, detail) => ({ change_type: type, detail });
const created = (s = snap()) => ch('CREATED', { after: s });
const updated = (s, before) => ch('UPDATED', { before, after: s });
const deleted = (before = snap()) => ch('DELETED', { before });

test('從沒寄過：新增（寄出前改過幾次，只寄最新版）', () => {
  const r = resolveLabel(null, [created(), updated(snap({ startTime: '15:00' }), snap()), updated(snap({ startTime: '16:00' }), snap({ startTime: '15:00' }))]);
  assert.equal(r.action, 'CREATED');
  assert.equal(r.state.startTime, '16:00');
});

test('寄出前新增又取消：不寄', () => {
  assert.equal(resolveLabel(null, [created(), deleted()]), null);
});

test('寄過、之後改時間：修改，記下改了什麼與上次寄出的版本', () => {
  const last = { last_action: 'CREATED', snapshot: snap() };
  const r = resolveLabel(last, [updated(snap({ startTime: '15:00' }), snap())]);
  assert.equal(r.action, 'UPDATED');
  assert.deepEqual(r.changedFields, ['startTime']);
  assert.equal(r.previous.startTime, '14:30');
});

test('寄過、改了又改回原樣：不寄', () => {
  const last = { last_action: 'CREATED', snapshot: snap() };
  assert.equal(resolveLabel(last, [updated(snap({ startTime: '15:00' }), snap()), updated(snap(), snap({ startTime: '15:00' }))]), null);
});

test('寄過、之後取消：取消', () => {
  const last = { last_action: 'UPDATED', snapshot: snap() };
  const r = resolveLabel(last, [deleted()]);
  assert.equal(r.action, 'CANCELED');
  assert.equal(r.state.branchName, '觀音店');
});

test('寄過取消之後又重新排進來：新增', () => {
  const last = { last_action: 'CANCELED', snapshot: snap() };
  assert.equal(resolveLabel(last, [created()]).action, 'CREATED');
});

test('寄過、這次只有同事名單變：員工算修改，客戶不用寄', () => {
  const last = { last_action: 'CREATED', snapshot: snap() };
  const after = snap({ assignees: [{ employeeId: '7', employeeName: '甲' }, { employeeId: '8', employeeName: '乙' }] });
  assert.equal(resolveLabel(last, [updated(after, snap())], true).action, 'UPDATED');
  assert.equal(resolveLabel(last, [updated(after, snap())], false), null);
});

test('沒有待處理異動：null', () => {
  assert.equal(resolveLabel(null, []), null);
});

const items = () => [
  { action: 'UPDATED', state: snap({ startTime: '10:00' }), changedFields: ['startTime'], previous: snap() },
  { action: 'CREATED', state: snap({ branchName: '板橋店', date: '2026-11-19', startTime: '09:00' }) },
  { action: 'CANCELED', state: snap({ branchName: '竹北店', timeMode: 'FLEXIBLE', startTime: null }) },
];

test('客戶信：一封信可同時有新增、修改、取消，各自標籤', () => {
  const m = buildMail({ recipientType: 'CUSTOMER', recipientName: '樂雅樂 - 觀音店', items: items(), date: '11/16' });
  assert.equal(m.subject, 'Ecolab 服務異動通知（11/16）');
  assert.match(m.text, /【新增】[\s\S]*板橋店/);
  assert.match(m.text, /【修改】[\s\S]*觀音店[\s\S]*（時間已更動）/);
  assert.match(m.text, /【取消】[\s\S]*彈性[\s\S]*竹北店/);
  assert.match(m.text, /白蟻/);
  assert.ok(m.text.indexOf('【新增】') < m.text.indexOf('【修改】') && m.text.indexOf('【修改】') < m.text.indexOf('【取消】'));
  assert.match(m.html, /<b>新增<\/b>/);
});

test('員工信：主旨與結尾用排班用語', () => {
  const m = buildMail({ recipientType: 'EMPLOYEE', recipientName: 'Demo 員工', items: items().slice(1, 2), date: '11/16' });
  assert.equal(m.subject, 'Ecolab 您的排班異動（11/16）');
  assert.match(m.text, /請準時前往處理/);
});

test('信件內容會跳脫 HTML', () => {
  const m = buildMail({ recipientType: 'CUSTOMER', recipientName: '<b>x</b>', items: items().slice(1, 2), date: '11/16' });
  assert.ok(!m.html.includes('<b>x</b>'));
});

test('發送紀錄：每個任務一筆，依日期時間排序，彈性沒有時間', () => {
  const log = toLogItems(items());
  assert.deepEqual(log.map((l) => l.action), ['CREATED', 'UPDATED', 'CANCELED']);
  assert.equal(log[1].taskTime, '1000');
  assert.equal(log[2].flexible, true);
  assert.equal(log[2].taskTime, undefined);
});
