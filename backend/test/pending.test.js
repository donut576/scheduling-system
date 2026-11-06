import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTaskToPending, assigneeIdsFromBody, toTaskBody } from '../src/services/pending.js';

const task = (over = {}) => ({
  id: '9', groupId: '2', groupName: '集團', branchId: '8', branchName: '分店', taskType: 'ESR', status: 'UNSCHEDULED',
  date: '', startTime: '22:00', endTime: '02:00', isOvernight: true, headcount: 1, shift: '晚班', route: '第三路',
  contents: ['P'], assignees: [{ employeeId: '5', employeeName: '王', licenses: ['PROFESSIONAL'], area: '台北' }],
  remarks: '', createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z', ...over,
});

test('任務轉成待排格式：未排班 = PENDING；指派人員只留 id 與姓名', () => {
  const p = mapTaskToPending(task());
  assert.equal(p.status, 'PENDING');
  assert.equal(p.id, '9');
  assert.deepEqual(p.assignees, [{ employeeId: '5', employeeName: '王' }]);
  assert.equal(p.isRecurring, false);
});

test('已排班的任務對待排而言是 CONVERTED', () => {
  assert.equal(mapTaskToPending(task({ status: 'SCHEDULED' })).status, 'CONVERTED');
});

test('指派人員：接受 [{employeeId, employeeName}] 或 id 字串；姓名不採用前端傳的', () => {
  assert.deepEqual(assigneeIdsFromBody([{ employeeId: '5', employeeName: '亂填' }, '7']), ['5', '7']);
  assert.equal(assigneeIdsFromBody(undefined), undefined);
  assert.deepEqual(assigneeIdsFromBody([]), []);
  assert.throws(() => assigneeIdsFromBody('5'), (e) => e.status === 422);
});

test('轉成修改任務的資料：拿掉用不到的欄位，指派改成 id 清單', () => {
  const body = toTaskBody({ groupId: '2', status: 'CONVERTED', recurrenceRule: { frequency: 'weekly' }, route: 'A',
    assignees: [{ employeeId: '5', employeeName: 'x' }] });
  assert.deepEqual(body, { route: 'A', assignees: ['5'] });
  assert.deepEqual(toTaskBody({ route: 'A' }), { route: 'A' });
  assert.deepEqual(toTaskBody(undefined), {});
});
