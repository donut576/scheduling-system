import test from 'node:test';
import assert from 'node:assert/strict';
import { diffTaskChanges, pickRegion } from '../src/services/taskChanges.js';

const base = (o = {}) => ({
  id: '1', status: 'SCHEDULED', branchId: '10', date: '2026-12-15', timeMode: 'FIXED', startTime: '09:00', endTime: '11:00',
  timeRemark: null, remarks: null, address: 'A 路', contents: ['P'], contactIds: ['100'],
  assignees: [{ employeeId: '7', employeeName: '甲' }], ...o,
});
const keys = (ev) => ev.map((e) => `${e.type}${e.id}:${e.changeType}`).sort();

test('建立且已排班：員工與客戶聯絡人都收到 CREATED', () => {
  assert.deepEqual(keys(diffTaskChanges(null, base())), ['CUSTOMER100:CREATED', 'EMPLOYEE7:CREATED']);
});

test('建立但還沒排滿（待排）：不記', () => {
  assert.deepEqual(diffTaskChanges(null, base({ status: 'UNSCHEDULED' })), []);
});

test('改時間：兩邊都是 UPDATED，且記下改了哪個欄位', () => {
  const ev = diffTaskChanges(base(), base({ startTime: '10:00' }));
  assert.deepEqual(keys(ev), ['CUSTOMER100:UPDATED', 'EMPLOYEE7:UPDATED']);
  assert.deepEqual(ev[0].detail.changedFields, ['startTime']);
});

test('沒有實際變動：不記', () => {
  assert.deepEqual(diffTaskChanges(base(), base()), []);
});

test('取消：所有收件人 DELETED', () => {
  assert.deepEqual(keys(diffTaskChanges(base(), base({ status: 'CANCELLED' }))), ['CUSTOMER100:DELETED', 'EMPLOYEE7:DELETED']);
});

test('員工被換掉：舊員工 DELETED、新員工 CREATED，客戶不受影響', () => {
  const ev = diffTaskChanges(base(), base({ assignees: [{ employeeId: '8', employeeName: '乙' }] }));
  assert.deepEqual(keys(ev), ['EMPLOYEE7:DELETED', 'EMPLOYEE8:CREATED']);
});

test('多一位同事：原員工 UPDATED（assignees），客戶不通知', () => {
  const ev = diffTaskChanges(base(), base({ assignees: [{ employeeId: '7', employeeName: '甲' }, { employeeId: '8', employeeName: '乙' }] }));
  assert.deepEqual(keys(ev), ['EMPLOYEE7:UPDATED', 'EMPLOYEE8:CREATED']);
  assert.deepEqual(ev.find((e) => e.id === '7').detail.changedFields, ['assignees']);
});

test('待核准 → 核准變已排班：視為新增', () => {
  assert.deepEqual(keys(diffTaskChanges(base({ status: 'PENDING_APPROVAL' }), base())), ['CUSTOMER100:CREATED', 'EMPLOYEE7:CREATED']);
});

test('已排班移回待排：視為取消', () => {
  assert.deepEqual(keys(diffTaskChanges(base(), base({ status: 'UNSCHEDULED' }))), ['CUSTOMER100:DELETED', 'EMPLOYEE7:DELETED']);
});

const cands = [{ id: '1', name: '北早' }, { id: '2', name: '北一晚' }, { id: '3', name: '北二晚' }];
test('同一行政區屬於早、晚群組：依任務班別挑（早班→北早、晚班→晚的群組）', () => {
  assert.equal(pickRegion(cands, { shift: '早班' }), '1');
  assert.equal(pickRegion(cands, { shift: '晚班' }), '2');
});
test('任務班別優先：早班同仁去支援晚班任務，任務仍屬於晚班群組', () => {
  assert.equal(pickRegion(cands, { assigneeRegionIds: ['1'], shift: '晚班' }), '2');
});
test('同班別有多個群組：有施作同仁所屬的群組優先', () => {
  assert.equal(pickRegion(cands, { assigneeRegionIds: ['3'], shift: '晚班' }), '3');
});
test('沒有班別資訊：依施作同仁所屬群組；都對不上取 id 最小；沒有候選回傳 null', () => {
  assert.equal(pickRegion(cands, { assigneeRegionIds: ['3'] }), '3');
  assert.equal(pickRegion(cands, {}), '1');
  assert.equal(pickRegion([], {}), null);
});
