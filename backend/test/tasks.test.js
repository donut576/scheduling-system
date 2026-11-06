import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskFilter, mapTask } from '../src/services/tasks.js';
import { resolveTaskScope } from '../src/services/taskScope.js';

const regionOf = (map) => async (no) => map[no] ?? null;
const lookup = regionOf({ L1: '北早', L2: '中區早', S1: '南區晚', S2: '桃二早' });

test('範圍：副理與管理員看全部', async () => {
  assert.deepEqual(await resolveTaskScope({ role: 'MANAGER', no: 'X' }, lookup), { all: true });
  assert.deepEqual(await resolveTaskScope({ role: 'ADMIN' }, lookup), { all: true });
});

test('範圍：主任看自己轄區加配對轄區（北／桃各群組互通、中嘉南早晚各群組互通）', async () => {
  assert.deepEqual((await resolveTaskScope({ role: 'LEADER', no: 'L1' }, lookup)).regionNames.sort(), ['北一晚', '北二晚', '北早', '桃一早', '桃二早', '桃竹晚'].sort());
  assert.deepEqual((await resolveTaskScope({ role: 'LEADER', no: 'L2' }, lookup)).regionNames.sort(), ['中區早', '中區晚', '嘉義早', '嘉義晚', '南區早', '南區晚'].sort());
});

test('範圍：一般員工只看自己轄區；查無轄區什麼都看不到', async () => {
  assert.deepEqual(await resolveTaskScope({ role: 'STAFF', no: 'S1' }, lookup), { regionNames: ['南區晚'] });
  assert.deepEqual(await resolveTaskScope({ role: 'STAFF', no: 'NOPE' }, lookup), { regionNames: [] });
  assert.deepEqual(await resolveTaskScope({ role: 'STAFF' }, lookup), { regionNames: [] });
});

test('篩選：沒有條件且不限範圍時沒有 WHERE', () => {
  assert.deepEqual(buildTaskFilter({}, { all: true }), { whereSql: '', values: [] });
});

test('篩選：只看已排班時排除待排與已取消，且不影響其他條件的參數', () => {
  const r = buildTaskFilter({ taskType: 'ESR' }, { all: true }, { onlyScheduled: true });
  assert.ok(r.whereSql.includes("t.status NOT IN ('UNSCHEDULED', 'CANCELLED', 'PENDING_APPROVAL')"));
  assert.deepEqual(r.values, ['ESR']);
  assert.ok(!buildTaskFilter({}, { all: true }).whereSql.includes('NOT IN'));
});

test('篩選：範圍為空時一定查不到', () => {
  assert.equal(buildTaskFilter({}, { regionNames: [] }).whereSql, 'WHERE FALSE');
});

test('篩選：條件一律用參數，值不會出現在 SQL 字串裡', () => {
  const evil = "x'; DROP TABLE tasks;--";
  const { whereSql, values } = buildTaskFilter({ keyword: evil, status: 'SCHEDULED', startDate: '2026-11-01' }, { regionNames: ['台北'] });
  assert.ok(!whereSql.includes('DROP'));
  assert.ok(!whereSql.includes('台北'));
  assert.deepEqual(values, [['台北'], `%${evil}%`, 'SCHEDULED', '2026-11-01']);
  assert.match(whereSql, /\$1.*\$2.*\$3.*\$4/s);
});

test('篩選：關鍵字中的 % 與 _ 會被跳脫，不會變萬用字元', () => {
  const { values } = buildTaskFilter({ keyword: '50%_off' }, { all: true });
  assert.equal(values[0], '%50\\%\\_off%');
});

test('篩選：groupId 不是正整數時回 422', () => {
  assert.throws(() => buildTaskFilter({ groupId: 'abc' }, { all: true }), (e) => e.status === 422);
});

test('mapTask：轉成前端 Task 格式（空值用空字串、id 為字串）', () => {
  const t = mapTask({
    id: 7, task_type: 'CONTRACT', status: 'UNSCHEDULED', alert_status: 'CLEAN', date: null, time_mode: 'FIXED',
    start_time: null, end_time: null, is_overnight: false, headcount: 1, shift: null, route: null,
    remarks: null, is_makeup: false, from_pending_id: null, series_id: null, created_by: 3,
    created_at: '2026-11-02T00:00:00Z', updated_at: '2026-11-02T00:00:00Z',
    customer_id: 5, branch_name: '分店', group_id: 2, group_name: '集團',
  }, { contents: ['P'] });
  assert.equal(t.id, '7');
  assert.equal(t.branchId, '5');
  assert.equal(t.groupId, '2');
  assert.equal(t.date, '');
  assert.equal(t.startTime, '');
  assert.equal(t.route, '');
  assert.deepEqual(t.contents, ['P']);
  assert.equal(t.isApproved, false);
  assert.equal(t.isFromPending, false);
  assert.equal(t.createdBy, '3');
  assert.equal(t.recurrenceId, undefined);
});
