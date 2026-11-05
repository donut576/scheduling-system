import test from 'node:test';
import assert from 'node:assert/strict';
import { isFullyScheduled, statusForCreate, statusForUpdate, checkTimes } from '../src/services/taskWrite.js';
import { buildCustomerFilter, mapCustomer } from '../src/services/customers.js';
import { buildEmployeeFilter, mapEmployee } from '../src/services/employees.js';

const full = { date: '2026-12-01', timeMode: 'FIXED', startTime: '09:00', endTime: '11:00', headcount: 1, assigneeCount: 1 };

test('已排班：人數到齊、有日期、時間齊全', () => {
  assert.equal(isFullyScheduled(full), true);
  assert.equal(isFullyScheduled({ ...full, assigneeCount: 0 }), false);
  assert.equal(isFullyScheduled({ ...full, headcount: 2 }), false);
  assert.equal(isFullyScheduled({ ...full, date: '' }), false);
  assert.equal(isFullyScheduled({ ...full, endTime: '' }), false);
});

test('彈性任務只要有日期、人數到齊就算已排班', () => {
  assert.equal(isFullyScheduled({ ...full, timeMode: 'FLEXIBLE', startTime: null, endTime: null }), true);
  assert.equal(isFullyScheduled({ ...full, timeMode: 'FLEXIBLE', startTime: null, endTime: null, date: '' }), false);
});

test('新增時的狀態', () => {
  assert.equal(statusForCreate(full), 'SCHEDULED');
  assert.equal(statusForCreate({ ...full, assigneeCount: 0 }), 'UNSCHEDULED');
});

test('修改時的狀態：未排班→已排班；已排班再改→已更改；條件不齊→未排班', () => {
  assert.equal(statusForUpdate('UNSCHEDULED', full), 'SCHEDULED');
  assert.equal(statusForUpdate('SCHEDULED', full), 'MODIFIED');
  assert.equal(statusForUpdate('MODIFIED', full), 'MODIFIED');
  assert.equal(statusForUpdate('SCHEDULED', { ...full, assigneeCount: 0 }), 'UNSCHEDULED');
});

test('時間檢查：固定時段要有起訖；結束早於開始算跨夜；彈性不存時間', () => {
  assert.deepEqual(checkTimes({ timeMode: 'FIXED', startTime: '09:00', endTime: '11:00' }), { startTime: '09:00', endTime: '11:00', isOvernight: false });
  assert.equal(checkTimes({ timeMode: 'FIXED', startTime: '22:00', endTime: '06:00' }).isOvernight, true);
  assert.deepEqual(checkTimes({ timeMode: 'FLEXIBLE', startTime: '09:00', endTime: '10:00' }), { startTime: null, endTime: null, isOvernight: false });
  assert.throws(() => checkTimes({ timeMode: 'FIXED', startTime: '09:00', endTime: '' }), (e) => e.status === 422);
});

test('客戶篩選：只列啟用中；範圍與關鍵字都用參數', () => {
  const evil = "x'; DROP TABLE customers;--";
  const { whereSql, values } = buildCustomerFilter({ keyword: evil, groupId: '3' }, { regionNames: ['台北'] });
  assert.match(whereSql, /c\.is_active/);
  assert.ok(!whereSql.includes('DROP') && !whereSql.includes('台北'));
  assert.deepEqual(values, [['台北'], `%${evil}%`, '3']);
  assert.equal(buildCustomerFilter({}, { all: true }).whereSql, 'WHERE c.is_active');
  assert.match(buildCustomerFilter({}, { regionNames: [] }).whereSql, /FALSE/);
});

test('客戶轉成前端格式：證照限制對應 requiredLicenses', () => {
  const c = mapCustomer({ id: 5, group_id: 2, group_name: '集團', name: '分店', address: null, latitude: null, longitude: null,
    license_restriction: 'PEST_CONTROL', license_restriction_note: null, remarks: null, contact_name: null, contact_phone: null });
  assert.equal(c.id, '5'); assert.equal(c.branchId, '5'); assert.equal(c.groupId, '2');
  assert.deepEqual(c.requiredLicenses, ['PEST_CONTROL']);
  assert.equal(c.address, ''); assert.equal(c.latitude, undefined);
});

test('員工篩選：參數化、不回傳密碼欄位', () => {
  const { whereSql, values } = buildEmployeeFilter({ keyword: "a'b", license: 'FIRE_ANT', groupId: '2' }, { regionNames: ['台北', '新竹'] });
  assert.ok(!whereSql.includes("a'b") && !whereSql.includes('FIRE_ANT'));
  assert.equal(values.length, 4);
  const e = mapEmployee({ id: 9, name: '王', phone: null, employee_no: 'E1', is_active: true, position: 'STAFF', region_id: 3, region_name: '中區早',
    color: '#fff', shift_name: '早班', leave_type: null, leaves: ['2026-12-02', '2026-12-01'], licenses: ['PROFESSIONAL'], password: 'secret' });
  assert.equal(e.groupName, '中區早');
  assert.deepEqual(e.designatedLeaves, ['2026-12-01', '2026-12-02']);
  assert.ok(!('password' in e));
});
